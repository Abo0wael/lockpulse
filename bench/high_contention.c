/*
 * Family:           high_contention               (split: train)
 * Expected outcome: HEALTHY - completes and exits 0 (hard negative: many
 *                   threads constantly blocked in futex on one mutex).
 * Structure:        N = --threads workers (default 16) start together at a
 *                   barrier, then repeat bursts until --work-ms (+-20 %, seeded)
 *                   has elapsed: a burst is --iters lock / increment / unlock
 *                   rounds on ONE shared mutex with a --cs-us critical section,
 *                   followed by busy think time of 1/--rate s (bursts per second).
 * Forcing:          none needed; the start barrier only aligns the threads.
 * Duration:         ~work_ms (1-4 s in configs); progress every burst.
 * Tier F budget:    3 records per round; keep iters*rate*work_ms/1000 <= ~40000
 *                   per thread (131072 records per thread available).
 * Check:            counter == total rounds of all threads, else exit 4.
 * Defaults:         threads 16, cs_us 0, work_ms 2000, rate 20, iters 300.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t counter_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t start_line;
static uint64_t counter;
static uint64_t deadline_ns;
static struct bench_args A;

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_barrier_wait(&start_line);
    bench_start_offset(&t->rng);
    while (bench_now_ns() < deadline_ns) {
        for (long i = 0; i < A.iters; i++) {
            bench_check(pthread_mutex_lock(&counter_lock), "lock");
            counter++;
            bench_cs(&t->rng, A.cs_us);
            bench_check(pthread_mutex_unlock(&counter_lock), "unlock");
            t->ops++;
        }
        bench_think(&t->rng, A.rate > 0 ? A.rate : 20);
    }
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 16, .cs_us = 0, .work_ms = 2000, .rate = 20, .iters = 300,
                            .force = 0, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("high_contention", &A, 1);
    bench_print_args("high_contention", &A);

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

    uint64_t expected = 0;
    for (long i = 0; i < A.threads; i++)
        expected += ts[i].ops;
    if (counter != expected) {
        fprintf(stderr, "high_contention: counter=%llu expected=%llu\n", (unsigned long long)counter,
                (unsigned long long)expected);
        return 4;
    }
    printf("high_contention: counter=%llu\n", (unsigned long long)counter);
    bench_finish("high_contention", t0);
    free(th);
    free(ts);
    return 0;
}
