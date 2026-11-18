/*
 * Family:           sleeping_workers              (split: train)
 * Expected outcome: HEALTHY (hard negative) - completes and exits 0, but for
 *                   1-2 s every thread sits in nanosleep and nothing happens.
 * Structure:        phase A: lock activity on mutex W for --work-ms (+-25 %,
 *                   --cs-us, --rate); then all threads meet at a barrier and each
 *                   sleeps a seeded 1000-2000 ms (nanosleep); phase B: lock
 *                   activity for --work-ms again; done.
 * Forcing:          the barrier makes the sleeps overlap; correctness does not
 *                   depend on the sleep (the sleep is the behaviour under test).
 * Progress gap:     <= 2 s (sleep is capped at 2000 ms), below the 3 s watchdog.
 * Duration:         ~2*work_ms + 1-2 s (2-4 s with configs).
 * Defaults:         threads 8, cs_us 20, work_ms 500, rate 200.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t lock_w = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t all_done_a;
static uint64_t work_count;
static struct bench_args A;

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_start_offset(&t->rng);
    bench_lock_phase(&lock_w, &work_count, A.work_ms, A.cs_us, A.rate, &t->rng);
    bench_barrier_wait(&all_done_a);
    bench_sleep_ms((long)bench_rng_range(&t->rng, 1000, 2000));
    bench_lock_phase(&lock_w, &work_count, A.work_ms, A.cs_us, A.rate, &t->rng);
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 8, .cs_us = 20, .work_ms = 500, .rate = 200, .iters = 0,
                            .force = 0, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("sleeping_workers", &A, 1);
    bench_print_args("sleeping_workers", &A);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&all_done_a, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    bench_finish("sleeping_workers", t0);
    free(th);
    free(ts);
    return 0;
}
