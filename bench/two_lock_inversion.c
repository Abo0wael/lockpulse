/*
 * Family:           two_lock_inversion
 * Expected outcome: HANGS - deadlock (ABBA lock-order inversion between 2 threads).
 * Forced by:        T1 locks A and T2 locks B, then both wait on a 2-party
 *                   pthread_barrier. Only after both hold their first lock does
 *                   either pass the barrier; T1 then requests B and T2 requests
 *                   A. The cycle is guaranteed with no timing assumptions.
 * Args:             --seed is accepted for uniformity; it does not change behaviour.
 *                   --threads/--iters/--cs-us are accepted and ignored.
 * Main joins both threads, so the whole process hangs until killed.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t lock_a = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t lock_b = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t both_hold_first;

static void *t1_main(void *arg)
{
    (void)arg;
    bench_check(pthread_mutex_lock(&lock_a), "T1 lock A");
    bench_barrier_wait(&both_hold_first);
    bench_check(pthread_mutex_lock(&lock_b), "T1 lock B"); /* blocks forever */
    bench_check(pthread_mutex_unlock(&lock_b), "T1 unlock B");
    bench_check(pthread_mutex_unlock(&lock_a), "T1 unlock A");
    return NULL;
}

static void *t2_main(void *arg)
{
    (void)arg;
    bench_check(pthread_mutex_lock(&lock_b), "T2 lock B");
    bench_barrier_wait(&both_hold_first);
    bench_check(pthread_mutex_lock(&lock_a), "T2 lock A"); /* blocks forever */
    bench_check(pthread_mutex_unlock(&lock_a), "T2 unlock A");
    bench_check(pthread_mutex_unlock(&lock_b), "T2 unlock B");
    return NULL;
}

int main(int argc, char **argv)
{
    struct bench_args a = {.threads = 2, .iters = 1, .cs_us = 0, .seed = 1, .cs_us_set = 0};
    bench_parse(argc, argv, &a);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&both_hold_first, NULL, 2), "barrier init");

    pthread_t t1, t2;
    bench_check(pthread_create(&t1, NULL, t1_main, NULL), "create T1");
    bench_check(pthread_create(&t2, NULL, t2_main, NULL), "create T2");
    bench_check(pthread_join(t1, NULL), "join T1");
    bench_check(pthread_join(t2, NULL), "join T2");

    pthread_barrier_destroy(&both_hold_first);
    printf("two_lock_inversion: completed (unexpected) seed=%llu\n", (unsigned long long)a.seed);
    printf("elapsed_ns=%llu\n", (unsigned long long)(bench_now_ns() - t0));
    return 0;
}
