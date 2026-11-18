/*
 * Family:           dining_philosophers           (split: test)
 * Expected outcome: HANG - deadlock (N-way cycle: every philosopher holds its
 *                   left fork and waits for its right one).
 * Structure:        N = --threads philosophers and N forks (mutexes). A healthy
 *                   lock phase on mutex W comes first (--work-ms, --cs-us, --rate).
 *                   Philosopher i always takes fork i (left), then fork (i+1)%N.
 * Forced (--force 1, default): every philosopher takes its left fork, then all
 *                   meet at a barrier, then all request their right fork.
 * Unforced (--force 0): --iters meals of take left; eat (cs); take right; eat;
 *                   put both; think. The scheduler decides whether all N hold
 *                   their left fork at once.
 * Defaults:         threads 5, cs_us 0, work_ms 300, rate 200, iters 200, force 1.
 * Main joins all threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t *forks;
static pthread_mutex_t lock_w = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t all_hold_left;
static uint64_t warm_count;
static struct bench_args A;

static void *philosopher(void *arg)
{
    struct bench_thread *t = arg;
    pthread_mutex_t *left = &forks[t->idx];
    pthread_mutex_t *right = &forks[(t->idx + 1) % A.threads];

    bench_start_offset(&t->rng);
    bench_lock_phase(&lock_w, &warm_count, A.work_ms, A.cs_us, A.rate, &t->rng);

    if (A.force) {
        bench_check(pthread_mutex_lock(left), "take left");
        bench_barrier_wait(&all_hold_left);
        bench_check(pthread_mutex_lock(right), "take right"); /* blocks forever */
        bench_check(pthread_mutex_unlock(right), "put right");
        bench_check(pthread_mutex_unlock(left), "put left");
        return NULL;
    }

    for (long meal = 0; meal < A.iters; meal++) {
        bench_check(pthread_mutex_lock(left), "take left");
        bench_cs(&t->rng, A.cs_us);
        bench_check(pthread_mutex_lock(right), "take right");
        bench_cs(&t->rng, A.cs_us);
        t->ops++;
        bench_check(pthread_mutex_unlock(right), "put right");
        bench_check(pthread_mutex_unlock(left), "put left");
        bench_think(&t->rng, A.rate);
    }
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 5, .cs_us = 0, .work_ms = 300, .rate = 200, .iters = 200,
                            .force = 1, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("dining_philosophers", &A, 2);
    bench_print_args("dining_philosophers", &A);

    uint64_t t0 = bench_now_ns();
    forks = calloc((size_t)A.threads, sizeof *forks);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (forks == NULL || th == NULL)
        return 3;
    for (long i = 0; i < A.threads; i++)
        bench_check(pthread_mutex_init(&forks[i], NULL), "mutex init");
    bench_check(pthread_barrier_init(&all_hold_left, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    bench_spawn(th, A.threads, philosopher, ts, sizeof *ts);
    bench_join(th, A.threads);

    bench_finish("dining_philosophers", t0);
    free(th);
    free(ts);
    free(forks);
    return 0;
}
