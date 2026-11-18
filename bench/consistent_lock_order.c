/*
 * Family:           consistent_lock_order         (split: validation)
 * Expected outcome: HEALTHY - completes and exits 0 (hard negative: many locks,
 *                   nested acquisition, lots of futex waiting, but no cycle is
 *                   possible because every thread follows one global order).
 * Structure:        L = --iters mutexes (default 8). Until --work-ms (+-20 %)
 *                   has elapsed, each of the --threads workers repeatedly picks a
 *                   seeded random subset of 2-3 locks, acquires them in
 *                   ascending index order, works --cs-us, releases them in
 *                   reverse order, then thinks for 1/--rate s (busy).
 * Forcing:          none needed; a start barrier aligns the threads.
 * Duration:         ~work_ms (1-4 s in configs); progress on every operation.
 * Check:            sum of per-lock counters == total lock acquisitions, else 4.
 * Defaults:         threads 8, cs_us 20, work_ms 2000, rate 300, iters 8 (locks).
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

#define MAX_LOCKS 64

static pthread_mutex_t locks[MAX_LOCKS];
static uint64_t lock_count[MAX_LOCKS];
static pthread_barrier_t start_line;
static uint64_t deadline_ns;
static long nlocks;
static struct bench_args A;

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_barrier_wait(&start_line);
    bench_start_offset(&t->rng);
    while (bench_now_ns() < deadline_ns) {
        /* pick k distinct locks, then sort ascending: the global order */
        long k = 2 + (long)(bench_rng_next(&t->rng) % 2u);
        if (k > nlocks)
            k = nlocks;
        long pick[3] = {0, 0, 0};
        long n = 0;
        while (n < k) {
            long c = (long)(bench_rng_next(&t->rng) % (uint64_t)nlocks);
            int dup = 0;
            for (long j = 0; j < n; j++)
                dup |= (pick[j] == c);
            if (!dup)
                pick[n++] = c;
        }
        for (long i = 1; i < n; i++) /* insertion sort */
            for (long j = i; j > 0 && pick[j - 1] > pick[j]; j--) {
                long tmp = pick[j];
                pick[j] = pick[j - 1];
                pick[j - 1] = tmp;
            }

        for (long i = 0; i < n; i++) {
            bench_check(pthread_mutex_lock(&locks[pick[i]]), "lock");
            lock_count[pick[i]]++;
        }
        bench_cs(&t->rng, A.cs_us);
        for (long i = n - 1; i >= 0; i--)
            bench_check(pthread_mutex_unlock(&locks[pick[i]]), "unlock");
        t->ops += (uint64_t)n;
        bench_think(&t->rng, A.rate > 0 ? A.rate : 300);
    }
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 8, .cs_us = 20, .work_ms = 2000, .rate = 300, .iters = 8,
                            .force = 0, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("consistent_lock_order", &A, 1);
    if (A.iters < 2 || A.iters > MAX_LOCKS) {
        fprintf(stderr, "consistent_lock_order: --iters (lock count) must be in [2, %d]\n", MAX_LOCKS);
        return 2;
    }
    nlocks = A.iters;
    bench_print_args("consistent_lock_order", &A);

    for (long i = 0; i < nlocks; i++)
        bench_check(pthread_mutex_init(&locks[i], NULL), "mutex init");
    uint64_t rng = bench_thread_rng(A.seed, 1000);
    uint64_t t0 = bench_now_ns();
    deadline_ns = t0 + bench_jitter(&rng, (uint64_t)A.work_ms * 1000000ull, 20);
    bench_check(pthread_barrier_init(&start_line, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    uint64_t got = 0, expected = 0;
    for (long i = 0; i < nlocks; i++)
        got += lock_count[i];
    for (long i = 0; i < A.threads; i++)
        expected += ts[i].ops;
    if (got != expected) {
        fprintf(stderr, "consistent_lock_order: counted %llu expected %llu\n", (unsigned long long)got,
                (unsigned long long)expected);
        return 4;
    }
    bench_finish("consistent_lock_order", t0);
    free(th);
    free(ts);
    return 0;
}
