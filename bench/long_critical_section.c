/*
 * Family:           long_critical_section         (split: train)
 * Expected outcome: HEALTHY (hard negative) - completes and exits 0, but for
 *                   1-2.5 s it looks like a hang from outside: one thread is
 *                   running, all others are blocked in futex on the same mutex,
 *                   and no lock is acquired or released.
 * Structure:        lock phase on mutex M (--work-ms, --cs-us, --rate), then the
 *                   holder (thread 0) locks M BEFORE arriving at a barrier of all
 *                   threads; waiters pass the barrier and call lock(M), so they
 *                   always find it held. The holder busy-loops (real CPU work,
 *                   never sleep) for the hold time, then releases. A final lock
 *                   phase of work_ms/2 follows.
 * Hold time:        seeded uniform in [1.0, 2.5] s. The guide says 1-3 s; it is
 *                   capped at 2.5 s because a healthy family must never go 3 s
 *                   without a progress event (watchdog). --cs-us > 0 sets the hold
 *                   explicitly (still capped at 2.5 s); the phases use 1/50 of it
 *                   as their per-operation critical section, at most 200 us.
 * Duration:         ~work_ms * 1.5 + hold (1.7-3.5 s with configs).
 * Check:            counter == total lock rounds, else exit 4.
 * Defaults:         threads 4, cs_us 0 (seeded hold), work_ms 400, rate 200.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

#define MAX_HOLD_US 2500000L

static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t holder_has_lock;
static uint64_t counter, waiter_rounds;
static long hold_us, phase_cs_us;
static struct bench_args A;

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_start_offset(&t->rng);
    bench_lock_phase(&m, &counter, A.work_ms, phase_cs_us, A.rate, &t->rng);

    if (t->idx == 0) {
        bench_check(pthread_mutex_lock(&m), "holder lock");
        bench_barrier_wait(&holder_has_lock);
        bench_sink = bench_busy_ns((uint64_t)hold_us * 1000ull); /* the long critical section */
        bench_check(pthread_mutex_unlock(&m), "holder unlock");
    } else {
        bench_barrier_wait(&holder_has_lock);
        bench_check(pthread_mutex_lock(&m), "waiter lock"); /* blocks until the holder releases */
        waiter_rounds++;
        bench_check(pthread_mutex_unlock(&m), "waiter unlock");
    }

    bench_lock_phase(&m, &counter, A.work_ms / 2, phase_cs_us, A.rate, &t->rng);
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 4, .cs_us = 0, .work_ms = 400, .rate = 200, .iters = 0,
                            .force = 0, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("long_critical_section", &A, 2);

    uint64_t rng = bench_thread_rng(A.seed, 1000);
    hold_us = (A.cs_us > 0) ? A.cs_us : (long)bench_rng_range(&rng, 1000000, MAX_HOLD_US);
    if (hold_us > MAX_HOLD_US)
        hold_us = MAX_HOLD_US;
    phase_cs_us = (A.cs_us > 0) ? (A.cs_us / 50 > 200 ? 200 : A.cs_us / 50) : 20;
    bench_print_args("long_critical_section", &A);
    printf("long_critical_section: hold_us=%ld\n", hold_us);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&holder_has_lock, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    if (waiter_rounds != (uint64_t)(A.threads - 1)) {
        fprintf(stderr, "long_critical_section: waiter_rounds=%llu expected=%ld\n",
                (unsigned long long)waiter_rounds, A.threads - 1);
        return 4;
    }
    bench_finish("long_critical_section", t0);
    free(th);
    free(ts);
    return 0;
}
