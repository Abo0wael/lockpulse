/*
 * tracebuf.c - create / map / validate Tier F trace files.
 * Linked into liblockpulse.so (shim), lp-run (watchdog) and lp-dump.
 * lp_tb_map must stay malloc-free and stdio-free: the shim calls it from its
 * constructor inside the traced process.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "tracebuf.h"

#include <errno.h>
#include <fcntl.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

uint64_t lp_tb_file_size(uint32_t max_threads, uint32_t records_per_thread)
{
    uint64_t region = (uint64_t)LP_REGION_HDR_SIZE + (uint64_t)records_per_thread * sizeof(struct lp_record);
    return (uint64_t)LP_HEADER_SIZE + (uint64_t)max_threads * region;
}

int lp_tb_create(const char *path, uint32_t max_threads, uint32_t records_per_thread)
{
    if (max_threads == 0 || records_per_thread == 0)
        return -EINVAL;

    uint64_t size = lp_tb_file_size(max_threads, records_per_thread);
    int fd = open(path, O_RDWR | O_CREAT | O_EXCL | O_CLOEXEC, 0644);
    if (fd < 0)
        return -errno;

    /* ftruncate gives a sparse, zero-filled file: untouched regions cost no disk. */
    if (ftruncate(fd, (off_t)size) != 0) {
        int e = errno;
        close(fd);
        unlink(path);
        return -e;
    }

    void *p = mmap(NULL, (size_t)size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    int e = errno;
    close(fd);
    if (p == MAP_FAILED) {
        unlink(path);
        return -e;
    }

    struct lp_header *h = (struct lp_header *)p;
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);

    h->schema_version = LP_SCHEMA_VERSION;
    h->max_threads = max_threads;
    h->records_per_thread = records_per_thread;
    h->header_size = LP_HEADER_SIZE;
    h->record_size = (uint32_t)sizeof(struct lp_record);
    h->region_size = (uint64_t)LP_REGION_HDR_SIZE + (uint64_t)records_per_thread * sizeof(struct lp_record);
    atomic_store_explicit(&h->progress_counter, 0, memory_order_relaxed);
    atomic_store_explicit(&h->next_slot, 0, memory_order_relaxed);
    atomic_store_explicit(&h->overflow, 0, memory_order_relaxed);
    atomic_store_explicit(&h->dropped_records, 0, memory_order_relaxed);
    h->created_ns = (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;

    /* Magic last: a reader that sees the magic sees a complete header. */
    atomic_thread_fence(memory_order_release);
    memcpy(h->magic, LP_MAGIC, 4);

    if (msync(p, LP_HEADER_SIZE, MS_SYNC) != 0) {
        e = errno;
        munmap(p, (size_t)size);
        return -e;
    }
    munmap(p, (size_t)size);
    return 0;
}

int lp_tb_map(const char *path, int writable, struct lp_tracebuf *tb)
{
    tb->hdr = NULL;
    tb->map_size = 0;

    int fd = open(path, (writable ? O_RDWR : O_RDONLY) | O_CLOEXEC);
    if (fd < 0)
        return -errno;

    struct stat st;
    if (fstat(fd, &st) != 0) {
        int e = errno;
        close(fd);
        return -e;
    }
    if (st.st_size < (off_t)LP_HEADER_SIZE) {
        close(fd);
        return -EPROTO;
    }

    size_t size = (size_t)st.st_size;
    int prot = PROT_READ | (writable ? PROT_WRITE : 0);
    void *p = mmap(NULL, size, prot, MAP_SHARED, fd, 0);
    int e = errno;
    close(fd);
    if (p == MAP_FAILED)
        return -e;

    struct lp_header *h = (struct lp_header *)p;
    int rc = 0;
    if (memcmp(h->magic, LP_MAGIC, 4) != 0) {
        rc = -EBADMSG;
    } else if (h->schema_version != LP_SCHEMA_VERSION || h->header_size != LP_HEADER_SIZE ||
               h->record_size != sizeof(struct lp_record) || h->max_threads == 0 ||
               h->records_per_thread == 0 ||
               h->region_size != (uint64_t)LP_REGION_HDR_SIZE +
                                     (uint64_t)h->records_per_thread * sizeof(struct lp_record) ||
               (uint64_t)size < lp_tb_file_size(h->max_threads, h->records_per_thread)) {
        rc = -EPROTO;
    }
    if (rc != 0) {
        munmap(p, size);
        return rc;
    }

    atomic_thread_fence(memory_order_acquire);
    tb->hdr = h;
    tb->map_size = size;
    return 0;
}

void lp_tb_unmap(struct lp_tracebuf *tb)
{
    if (tb->hdr != NULL)
        munmap((void *)tb->hdr, tb->map_size);
    tb->hdr = NULL;
    tb->map_size = 0;
}

const char *lp_event_name(uint16_t event)
{
    switch (event) {
    case LP_EV_THREAD_FIRST_SEEN: return "THREAD_FIRST_SEEN";
    case LP_EV_MUTEX_REQ: return "MUTEX_REQ";
    case LP_EV_MUTEX_ACQ: return "MUTEX_ACQ";
    case LP_EV_MUTEX_REL: return "MUTEX_REL";
    case LP_EV_MUTEX_TRYLOCK_FAIL: return "MUTEX_TRYLOCK_FAIL";
    case LP_EV_ERROR: return "ERROR";
    case LP_EV_COND_WAIT_REQ: return "COND_WAIT_REQ";
    case LP_EV_COND_WAIT_RET: return "COND_WAIT_RET";
    case LP_EV_COND_TIMEDWAIT_REQ: return "COND_TIMEDWAIT_REQ";
    case LP_EV_COND_SIGNAL: return "COND_SIGNAL";
    case LP_EV_COND_BROADCAST: return "COND_BROADCAST";
    case LP_EV_SEM_WAIT_REQ: return "SEM_WAIT_REQ";
    case LP_EV_SEM_WAIT_RET: return "SEM_WAIT_RET";
    case LP_EV_SEM_POST: return "SEM_POST";
    case LP_EV_BARRIER_REQ: return "BARRIER_REQ";
    case LP_EV_BARRIER_RET: return "BARRIER_RET";
    default: return NULL;
    }
}
