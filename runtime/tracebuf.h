/*
 * tracebuf.h - Tier F trace buffer layout and API (LockPulse, schema v2).
 *
 * The trace file is created by the launcher (lp_tb_create), mapped
 * MAP_SHARED by the shim inside the target (lp_tb_map writable), and mapped
 * read-only by the launcher's watchdog and by lp-dump. Because the mapping is
 * MAP_SHARED and file-backed, every record that was fully written survives a
 * SIGKILL of the target.
 *
 * File layout (all integers little-endian, x86-64 natural alignment):
 *
 *   offset 0                       : struct lp_header, zero-padded to LP_HEADER_SIZE (4096)
 *   LP_HEADER_SIZE + s*region_size : region for slot s (0 <= s < max_threads)
 *       region = struct lp_region_hdr (64 bytes) + records_per_thread * struct lp_record
 *
 * struct lp_record (32 bytes, naturally aligned, no padding, no packing needed):
 *   off  0  u64 ts_ns      CLOCK_MONOTONIC ns at the event
 *   off  8  u64 wait_ns    *_ACQ / *_EXIT: ns since the matching request/enter;
 *                          ERROR: the error code (return value or errno); otherwise 0
 *   off 16  u64 obj_addr   address of the sync object (0 for THREAD_FIRST_SEEN)
 *   off 24  u32 tid        kernel thread id (gettid)
 *   off 28  u16 event      enum lp_event
 *   off 30  u16 site       0 = explicit call; LP_SITE_IMPLICIT = mutex release/
 *                          re-acquire performed inside pthread_cond_[timed]wait
 *
 * Schema history (lp-dump reads both):
 *   v1  phase 1: mutex events only (1..6); 65536 records/thread.
 *   v2  phase 2: + COND_*, SEM_*, BARRIER_* events, implicit cond mutex events,
 *       header.resolve_how[]; 131072 records/thread. Record layout unchanged.
 *
 * Concurrency: each thread owns exactly one region (slot claimed once with an
 * atomic fetch_add on next_slot). Only the owner writes its region, so the
 * writer does: write record[count]; store(count+1, release). Readers load
 * count with acquire and read records [0, count).
 */
#ifndef LOCKPULSE_TRACEBUF_H
#define LOCKPULSE_TRACEBUF_H

#include <stdatomic.h>
#include <stddef.h>
#include <stdint.h>

#define LP_MAGIC "LPTR"
#define LP_SCHEMA_VERSION 2u     /* written by lp_tb_create, required by the shim */
#define LP_SCHEMA_MIN_READ 1u    /* oldest version read-only mappers accept */
#define LP_DEFAULT_MAX_THREADS 64u
#define LP_DEFAULT_RECORDS_PER_THREAD 131072u
#define LP_HEADER_SIZE 4096u
#define LP_REGION_HDR_SIZE 64u

#define LP_SITE_IMPLICIT 0xFFFFu

/* bits of lp_header.overflow */
#define LP_OVF_RECORDS 0x1u /* a region was full; records were dropped */
#define LP_OVF_SLOTS 0x2u   /* more than max_threads threads tried to log */

enum lp_event {
    LP_EV_THREAD_FIRST_SEEN = 1,
    LP_EV_MUTEX_REQ = 2,
    LP_EV_MUTEX_ACQ = 3,
    LP_EV_MUTEX_REL = 4,
    LP_EV_MUTEX_TRYLOCK_FAIL = 5,
    LP_EV_ERROR = 6, /* the call returned an error; closes any pending wait of the thread */
    /* schema v2 */
    LP_EV_COND_WAIT_ENTER = 16,
    LP_EV_COND_WAIT_EXIT = 17,
    LP_EV_COND_SIGNAL = 18,
    LP_EV_COND_BROADCAST = 19,
    LP_EV_SEM_WAIT_ENTER = 32,
    LP_EV_SEM_WAIT_EXIT = 33,
    LP_EV_SEM_POST = 34,
    LP_EV_SEM_TRYWAIT_FAIL = 35,
    LP_EV_BARRIER_ENTER = 48,
    LP_EV_BARRIER_EXIT = 49
};

/* Events that advance header.progress_counter (and that the oracle treats as
 * progress). Keep in sync with ml/label.py PROGRESS_EVENTS. */
static inline int lp_is_progress(uint16_t ev)
{
    switch (ev) {
    case LP_EV_MUTEX_ACQ:
    case LP_EV_MUTEX_REL:
    case LP_EV_COND_SIGNAL:
    case LP_EV_COND_BROADCAST:
    case LP_EV_COND_WAIT_EXIT:
    case LP_EV_SEM_POST:
    case LP_EV_SEM_WAIT_EXIT:
    case LP_EV_BARRIER_EXIT:
        return 1;
    default:
        return 0;
    }
}

/* Interposed functions, in the order of header.resolve_how[]. */
enum lp_fn {
    LP_FN_MUTEX_LOCK = 0,
    LP_FN_MUTEX_TRYLOCK,
    LP_FN_MUTEX_UNLOCK,
    LP_FN_COND_WAIT,
    LP_FN_COND_TIMEDWAIT,
    LP_FN_COND_SIGNAL,
    LP_FN_COND_BROADCAST,
    LP_FN_SEM_WAIT,
    LP_FN_SEM_TIMEDWAIT,
    LP_FN_SEM_TRYWAIT,
    LP_FN_SEM_POST,
    LP_FN_BARRIER_WAIT,
    LP_FN_COUNT
};

/* values of header.resolve_how[fn] */
#define LP_RESOLVE_NONE 0u     /* not resolved (or v1 file) */
#define LP_RESOLVE_DLVSYM0 1u  /* dlvsym with the first (preferred) version */
#define LP_RESOLVE_DLVSYM1 2u  /* dlvsym with the second version */
#define LP_RESOLVE_DLSYM 3u    /* plain dlsym (function has no listed version) */

struct lp_record {
    uint64_t ts_ns;
    uint64_t wait_ns;
    uint64_t obj_addr;
    uint32_t tid;
    uint16_t event;
    uint16_t site;
};
_Static_assert(sizeof(struct lp_record) == 32, "lp_record must be 32 bytes");
_Static_assert(offsetof(struct lp_record, tid) == 24, "lp_record layout");
_Static_assert(offsetof(struct lp_record, site) == 30, "lp_record layout");

struct lp_header {
    char magic[4];                     /* "LPTR", written last by lp_tb_create */
    uint32_t schema_version;           /* LP_SCHEMA_VERSION */
    uint32_t max_threads;
    uint32_t records_per_thread;
    uint32_t header_size;              /* LP_HEADER_SIZE */
    uint32_t record_size;              /* sizeof(struct lp_record) */
    uint64_t region_size;              /* LP_REGION_HDR_SIZE + rpt * record_size */
    _Atomic uint64_t progress_counter; /* +1 on every progress event (lp_is_progress) */
    _Atomic uint32_t next_slot;        /* next free region; may exceed max_threads */
    _Atomic uint32_t overflow;         /* LP_OVF_* bits */
    _Atomic uint64_t dropped_records;  /* records lost because a region was full */
    uint64_t created_ns;               /* CLOCK_MONOTONIC ns at creation */
    /* v2 (zero in v1 files): how the shim resolved each real function, enum lp_fn order */
    uint8_t resolve_how[16];
};
_Static_assert(sizeof(struct lp_header) <= LP_HEADER_SIZE, "header too large");
_Static_assert(offsetof(struct lp_header, created_ns) == 56, "v1 header prefix must not move");
_Static_assert(LP_FN_COUNT <= 16, "resolve_how too small");

struct lp_region_hdr {
    _Atomic uint64_t count; /* records written in this region (<= records_per_thread) */
    uint32_t tid;           /* owner thread id */
    uint32_t reserved0;
    uint64_t reserved[6];
};
_Static_assert(sizeof(struct lp_region_hdr) == LP_REGION_HDR_SIZE, "region hdr must be 64 bytes");

struct lp_tracebuf {
    struct lp_header *hdr;
    size_t map_size;
};

/* Total file size for the given geometry. */
uint64_t lp_tb_file_size(uint32_t max_threads, uint32_t records_per_thread);

/* Create a new trace file (O_EXCL: never overwrites), size it and write the
 * header. Returns 0 or -errno. Not async-signal-safe; launcher only. */
int lp_tb_create(const char *path, uint32_t max_threads, uint32_t records_per_thread);

/* Map an existing trace file and validate it. writable=1 (the shim) requires
 * schema LP_SCHEMA_VERSION; read-only accepts LP_SCHEMA_MIN_READ..LP_SCHEMA_VERSION.
 * Uses only open/fstat/mmap/close (no malloc, no stdio), so it is safe to
 * call from the shim's constructor. Returns 0 or -errno (-EBADMSG bad magic,
 * -EPROTO wrong schema/geometry). */
int lp_tb_map(const char *path, int writable, struct lp_tracebuf *tb);

void lp_tb_unmap(struct lp_tracebuf *tb);

/* Event name for CSV output, or NULL if unknown. */
const char *lp_event_name(uint16_t event);

/* Name of an enum lp_fn entry, or NULL. */
const char *lp_fn_name(unsigned fn);

static inline struct lp_region_hdr *lp_tb_region(struct lp_header *h, uint32_t slot)
{
    return (struct lp_region_hdr *)((char *)h + h->header_size + (uint64_t)slot * h->region_size);
}

static inline struct lp_record *lp_tb_records(struct lp_header *h, uint32_t slot)
{
    return (struct lp_record *)((char *)lp_tb_region(h, slot) + LP_REGION_HDR_SIZE);
}

/* Hot path: append one record to the caller's own region. Never blocks,
 * never allocates. Returns 0, or -1 if the region is full (record dropped,
 * overflow flag set). */
static inline int lp_tb_append(struct lp_header *h, uint32_t slot, const struct lp_record *r)
{
    struct lp_region_hdr *rg = lp_tb_region(h, slot);
    uint64_t n = atomic_load_explicit(&rg->count, memory_order_relaxed);
    if (n >= h->records_per_thread) {
        atomic_fetch_or_explicit(&h->overflow, LP_OVF_RECORDS, memory_order_relaxed);
        atomic_fetch_add_explicit(&h->dropped_records, 1, memory_order_relaxed);
        return -1;
    }
    lp_tb_records(h, slot)[n] = *r;
    atomic_store_explicit(&rg->count, n + 1, memory_order_release);
    return 0;
}

#endif /* LOCKPULSE_TRACEBUF_H */
