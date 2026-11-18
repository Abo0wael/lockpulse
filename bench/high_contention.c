/*
 * Family:           high_contention               (split: train)
 * Expected outcome: HEALTHY - completes and exits 0 (hard negative: many
 *                   threads constantly blocked in futex on one mutex).
 * Structure:        N = --threads workers (default 16) start together at a
 *                   barrier, then loop until --work-ms (+-20 %, seeded) has
 *                   elapsed: lock ONE shared mutex, increment, --cs-us of busy
 *                   work (+-50 %), unlock, then busy think time of 1/--rate s
 *                   (+-50 %) per iteration. --iters > 0 caps the operations per
 *                   thread (safety bound for the Tier F budget).
 * Contention:       mutex utilisation U ~= threads * rate * cs. Configs keep
 *                   U ~= 0.9, so the mutex is busy almost all the time and
 *                   several threads are queued on it at any moment.
 * Forcing:          none needed; the start barrier only aligns the threads.
 * Duration:         ~work_ms (1.2-3.6 s in configs); progress on every operation.
 * Tier F budget:    3 records per operation; configs target ~16.7k operations
 *                   (~50k events) per run, i.e. threads*rate*work_ms/1000.
 * Fixed-work mode:  --work-ms 0 --rate 0 --iters N (used for overhead runs): no
 *                   time limit and no think time; every thread does exactly N
 *                   operations, so elapsed time and ops/s measure tracing cost.
 *                   The time-bounded mode above is the one used for collection.
 * Output:           "ops=<total lock operations>" and "ops_per_s=<...>".
 * Check:            counter == total operations of all threads, else exit 4.
 * Defaults:         threads 16, cs_us 80, work_ms 1500, rate 700 (ops/s/thread),
 *                   iters 0 (no cap).
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
    while ((A.work_ms <= 0 || bench_now_ns() < deadline_ns) && (A.iters <= 0 || t->ops < (uint64_t)A.iters)) {
        bench_check(pthread_mutex_lock(&counter_lock), "lock");
        counter++;
        bench_cs(&t->rng, A.cs_us);
        bench_check(pthread_mutex_unlock(&counter_lock), "unlock");
        t->ops++;
        bench_think(&t->rng, A.rate); /* per-iteration think time; rate 0 = none */
    }
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 16, .cs_us = 80, .work_ms = 1500, .rate = 700, .iters = 0,
                            .force = 0, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("high_contention", &A, 1);
    if (A.work_ms <= 0 && A.iters <= 0) {
        fprintf(stderr, "high_contention: --work-ms 0 (fixed-work mode) needs --iters > 0\n");
        return 2;
    }
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
    double secs = (double)(bench_now_ns() - t0) / 1e9;
    printf("high_contention: counter=%llu\n", (unsigned long long)counter);
    printf("ops=%llu\nops_per_s=%.0f\n", (unsigned long long)counter, secs > 0 ? (double)counter / secs : 0.0);
    bench_finish("high_contention", t0);
    free(th);
    free(ts);
    return 0;
}
