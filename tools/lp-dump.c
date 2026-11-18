/*
 * lp-dump.c - convert a Tier F trace buffer to CSV.
 *
 *   lp-dump <run>.bin > <run>.csv
 *   lp-dump --info <run>.bin        header fields (incl. symbol resolution) as key=value
 *
 * Reads schema v1 (phase 1) and v2 traces; the record layout is identical.
 *
 * Output columns: ts_ns,tid,event,obj_addr,wait_ns,site
 *   ts_ns     CLOCK_MONOTONIC ns
 *   tid       kernel thread id
 *   event     event name (e.g. MUTEX_ACQ); numeric if unknown
 *   obj_addr  sync object address, hex (0x0 for THREAD_FIRST_SEEN)
 *   wait_ns   *_ACQ / *_EXIT: ns since request/enter; ERROR: error code; else 0
 *   site      0 = explicit call; 65535 = implicit mutex REL/ACQ inside cond_wait
 * All threads are merged and sorted by ts_ns (ties: slot, then record order).
 *
 * A summary goes to stderr. Exit status: 0 ok, 1 usage/IO error,
 * 2 invalid file (bad magic/version), 3 ok but the buffer overflowed.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <errno.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "tracebuf.h"

struct entry {
    struct lp_record r;
    uint32_t slot;
    uint32_t idx;
};

static int cmp_entry(const void *a, const void *b)
{
    const struct entry *x = (const struct entry *)a;
    const struct entry *y = (const struct entry *)b;
    if (x->r.ts_ns != y->r.ts_ns)
        return x->r.ts_ns < y->r.ts_ns ? -1 : 1;
    if (x->slot != y->slot)
        return x->slot < y->slot ? -1 : 1;
    if (x->idx != y->idx)
        return x->idx < y->idx ? -1 : 1;
    return 0;
}

static const char *resolve_name(uint8_t how)
{
    switch (how) {
    case LP_RESOLVE_NONE: return "unresolved";
    case LP_RESOLVE_DLVSYM0: return "dlvsym:preferred";
    case LP_RESOLVE_DLVSYM1: return "dlvsym:fallback";
    case LP_RESOLVE_DLSYM: return "dlsym";
    default: return "unknown";
    }
}

/* --info: header fields as key=value lines on stdout. */
static int print_info(struct lp_header *h, uint32_t nslots)
{
    printf("schema_version=%u\n", (unsigned)h->schema_version);
    printf("max_threads=%u\n", (unsigned)h->max_threads);
    printf("records_per_thread=%u\n", (unsigned)h->records_per_thread);
    printf("threads_seen=%u\n", (unsigned)nslots);
    printf("progress_counter=%llu\n",
           (unsigned long long)atomic_load_explicit(&h->progress_counter, memory_order_acquire));
    printf("overflow_flags=%u\n", (unsigned)atomic_load_explicit(&h->overflow, memory_order_acquire));
    printf("dropped_records=%llu\n",
           (unsigned long long)atomic_load_explicit(&h->dropped_records, memory_order_acquire));
    printf("created_ns=%llu\n", (unsigned long long)h->created_ns);
    if (h->schema_version >= 2) {
        for (unsigned f = 0; f < LP_FN_COUNT; f++)
            printf("resolve.%s=%s\n", lp_fn_name(f), resolve_name(h->resolve_how[f]));
    }
    return fflush(stdout) == 0 ? 0 : 1;
}

int main(int argc, char **argv)
{
    int info = 0, bad = 0;
    const char *path = NULL;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--info") == 0)
            info = 1;
        else if (path == NULL && argv[i][0] != '-')
            path = argv[i];
        else
            bad = 1;
    }
    if (path == NULL || bad) {
        fprintf(stderr, "usage: lp-dump [--info] <run>.bin > <run>.csv\n");
        return 1;
    }

    struct lp_tracebuf tb;
    int rc = lp_tb_map(path, 0, &tb);
    if (rc == -EBADMSG || rc == -EPROTO) {
        fprintf(stderr, "lp-dump: %s: not a LockPulse trace (schema v%u..v%u): %s\n", path,
                (unsigned)LP_SCHEMA_MIN_READ, (unsigned)LP_SCHEMA_VERSION, strerror(-rc));
        return 2;
    }
    if (rc != 0) {
        fprintf(stderr, "lp-dump: %s: %s\n", path, strerror(-rc));
        return 1;
    }

    struct lp_header *h = tb.hdr;
    uint32_t nslots = atomic_load_explicit(&h->next_slot, memory_order_acquire);
    if (nslots > h->max_threads)
        nslots = h->max_threads;

    if (info) {
        rc = print_info(h, nslots);
        lp_tb_unmap(&tb);
        return rc;
    }

    uint64_t total = 0;
    for (uint32_t s = 0; s < nslots; s++) {
        uint64_t c = atomic_load_explicit(&lp_tb_region(h, s)->count, memory_order_acquire);
        if (c > h->records_per_thread)
            c = h->records_per_thread;
        total += c;
    }

    struct entry *ents = NULL;
    if (total > 0) {
        ents = malloc((size_t)total * sizeof *ents);
        if (ents == NULL) {
            fprintf(stderr, "lp-dump: out of memory for %llu records\n", (unsigned long long)total);
            lp_tb_unmap(&tb);
            return 1;
        }
    }

    uint64_t k = 0;
    for (uint32_t s = 0; s < nslots; s++) {
        uint64_t c = atomic_load_explicit(&lp_tb_region(h, s)->count, memory_order_acquire);
        if (c > h->records_per_thread)
            c = h->records_per_thread;
        const struct lp_record *recs = lp_tb_records(h, s);
        for (uint64_t i = 0; i < c && k < total; i++, k++) {
            ents[k].r = recs[i];
            ents[k].slot = s;
            ents[k].idx = (uint32_t)i;
        }
    }
    if (k > 0)
        qsort(ents, (size_t)k, sizeof *ents, cmp_entry);

    static char outbuf[1 << 20];
    setvbuf(stdout, outbuf, _IOFBF, sizeof outbuf);
    fputs("ts_ns,tid,event,obj_addr,wait_ns,site\n", stdout);
    for (uint64_t i = 0; i < k; i++) {
        const struct lp_record *r = &ents[i].r;
        const char *name = lp_event_name(r->event);
        if (name != NULL)
            printf("%llu,%u,%s,0x%llx,%llu,%u\n", (unsigned long long)r->ts_ns, (unsigned)r->tid, name,
                   (unsigned long long)r->obj_addr, (unsigned long long)r->wait_ns, (unsigned)r->site);
        else
            printf("%llu,%u,%u,0x%llx,%llu,%u\n", (unsigned long long)r->ts_ns, (unsigned)r->tid,
                   (unsigned)r->event, (unsigned long long)r->obj_addr, (unsigned long long)r->wait_ns,
                   (unsigned)r->site);
    }
    if (fflush(stdout) != 0) {
        fprintf(stderr, "lp-dump: write error: %s\n", strerror(errno));
        free(ents);
        lp_tb_unmap(&tb);
        return 1;
    }

    uint32_t ovf = atomic_load_explicit(&h->overflow, memory_order_acquire);
    uint64_t dropped = atomic_load_explicit(&h->dropped_records, memory_order_acquire);
    uint64_t progress = atomic_load_explicit(&h->progress_counter, memory_order_acquire);
    fprintf(stderr, "lp-dump: %llu events, %u threads, progress_counter=%llu, overflow=%s",
            (unsigned long long)k, (unsigned)nslots, (unsigned long long)progress, ovf ? "YES" : "no");
    if (ovf)
        fprintf(stderr, " (flags=0x%x, dropped_records=%llu)", (unsigned)ovf, (unsigned long long)dropped);
    fputc('\n', stderr);

    free(ents);
    lp_tb_unmap(&tb);
    return ovf ? 3 : 0;
}
