/*
 * Family:           three_thread_cycle            (split: validation)
 * Expected outcome: HANG - deadlock (cycle L0 -> L1 -> L2 -> L0 over 3 threads).
 * Structure:        healthy lock phase on mutex W first (--work-ms, --cs-us,
 *                   --rate). Thread i (i < 3) then takes L[i] and L[(i+1)%3].
 * Forced (--force 1, default): threads 0..2 each lock L[i], then ALL threads
 *                   meet at a barrier; afterwards thread i requests L[(i+1)%3]
 *                   (the cycle) and bystanders (i >= 3) request L[0] and queue.
 * Unforced (--force 0): every thread i does --iters rounds of
 *                   lock(L[i%3]); cs; lock(L[(i+1)%3]); unlock both; think.
 *                   The scheduler decides whether all three windows overlap.
 * Defaults:         threads 3, cs_us 0, work_ms 300, rate 200, iters 300, force 1.
 * Main joins all threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t locks[3] = {PTHREAD_MUTEX_INITIALIZER, PTHREAD_MUTEX_INITIALIZER,
                                   PTHREAD_MUTEX_INITIALIZER};
static pthread_mutex_t lock_w = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t hold_first;
static uint64_t warm_count;
static struct bench_args A;

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    pthread_mutex_t *first = &locks[t->idx % 3];
    pthread_mutex_t *second = &locks[(t->idx + 1) % 3];

    bench_start_offset(&t->rng);
    bench_lock_phase(&lock_w, &warm_count, A.work_ms, A.cs_us, A.rate, &t->rng);

    if (A.force) {
        if (t->idx < 3) {
            bench_check(pthread_mutex_lock(first), "lock first");
            bench_barrier_wait(&hold_first);
            bench_check(pthread_mutex_lock(second), "lock second"); /* blocks forever */
            bench_check(pthread_mutex_unlock(second), "unlock second");
            bench_check(pthread_mutex_unlock(first), "unlock first");
        } else {
            bench_barrier_wait(&hold_first);
            bench_check(pthread_mutex_lock(&locks[0]), "bystander lock L0");
            bench_check(pthread_mutex_unlock(&locks[0]), "bystander unlock L0");
        }
        return NULL;
    }

    for (long r = 0; r < A.iters; r++) {
        bench_check(pthread_mutex_lock(first), "lock first");
        bench_cs(&t->rng, A.cs_us);
        bench_check(pthread_mutex_lock(second), "lock second");
        t->ops++;
        bench_check(pthread_mutex_unlock(second), "unlock second");
        bench_check(pthread_mutex_unlock(first), "unlock first");
        bench_think(&t->rng, A.rate);
    }
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 3, .cs_us = 0, .work_ms = 300, .rate = 200, .iters = 300,
                            .force = 1, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("three_thread_cycle", &A, 3);
    bench_print_args("three_thread_cycle", &A);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&hold_first, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    bench_finish("three_thread_cycle", t0);
    free(th);
    free(ts);
    return 0;
}
