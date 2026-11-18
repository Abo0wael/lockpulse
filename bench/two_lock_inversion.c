/*
 * Family:           two_lock_inversion            (split: train)
 * Expected outcome: HANG - deadlock (ABBA lock-order inversion).
 * Structure:        every thread first runs a healthy lock phase on a separate
 *                   mutex W (--work-ms, --cs-us, --rate). Then even threads take
 *                   A then B, odd threads take B then A.
 * Forced (--force 1, default): T0 locks A and T1 locks B, then ALL threads meet
 *                   at a barrier; only then T0 requests B, T1 requests A, and the
 *                   other threads ("bystanders") request A and queue behind the
 *                   cycle. The deadlock is guaranteed with no timing assumption.
 * Unforced (--force 0): every thread does --iters rounds of
 *                   lock(first); cs; lock(second); unlock both; think. Whether
 *                   the ABBA window is ever hit is up to the scheduler; if it is
 *                   not, the program finishes normally.
 * Defaults:         threads 2, cs_us 0, work_ms 300, rate 200, iters 300, force 1.
 * Main joins all threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t lock_a = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t lock_b = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t lock_w = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t hold_first;
static uint64_t warm_count;
static struct bench_args A;

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    int odd = (int)(t->idx % 2);
    pthread_mutex_t *first = odd ? &lock_b : &lock_a;
    pthread_mutex_t *second = odd ? &lock_a : &lock_b;

    bench_start_offset(&t->rng);
    bench_lock_phase(&lock_w, &warm_count, A.work_ms, A.cs_us, A.rate, &t->rng);

    if (A.force) {
        if (t->idx < 2) {
            bench_check(pthread_mutex_lock(first), "lock first");
            bench_barrier_wait(&hold_first);
            bench_check(pthread_mutex_lock(second), "lock second"); /* blocks forever */
            bench_check(pthread_mutex_unlock(second), "unlock second");
            bench_check(pthread_mutex_unlock(first), "unlock first");
        } else {
            bench_barrier_wait(&hold_first);
            bench_check(pthread_mutex_lock(&lock_a), "bystander lock A"); /* queues behind T0 */
            bench_check(pthread_mutex_unlock(&lock_a), "bystander unlock A");
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
    A = (struct bench_args){.threads = 2, .cs_us = 0, .work_ms = 300, .rate = 200, .iters = 300,
                            .force = 1, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("two_lock_inversion", &A, 2);
    bench_print_args("two_lock_inversion", &A);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&hold_first, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    bench_finish("two_lock_inversion", t0);
    free(th);
    free(ts);
    return 0;
}
