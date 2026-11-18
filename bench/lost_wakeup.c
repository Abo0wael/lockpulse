/*
 * Family:           lost_wakeup
 * Expected outcome: HANGS - lost wakeup (no lock cycle; nobody holds a lock while hung).
 * Forced by:        The signaler locks m, calls pthread_cond_signal while no thread
 *                   is waiting, unlocks m, and only then arrives at a 2-party
 *                   pthread_barrier. The waiter passes the barrier (so the signal
 *                   has definitely already been sent and lost), locks m and calls
 *                   pthread_cond_wait WITHOUT a predicate loop - the bug.
 * Args:             --seed accepted for uniformity (no effect); others ignored.
 * Note:             pthread_cond_* is not traced in phase 1; Tier F shows only the
 *                   mutex events around it. Main joins both threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static pthread_barrier_t signal_sent;

static void *signaler_main(void *arg)
{
    (void)arg;
    bench_check(pthread_mutex_lock(&m), "signaler lock");
    bench_check(pthread_cond_signal(&cv), "cond_signal"); /* nobody waits: lost */
    bench_check(pthread_mutex_unlock(&m), "signaler unlock");
    bench_barrier_wait(&signal_sent);
    return NULL;
}

static void *waiter_main(void *arg)
{
    (void)arg;
    bench_barrier_wait(&signal_sent);
    bench_check(pthread_mutex_lock(&m), "waiter lock");
    /* BUG (intentional): no `while (!ready)` predicate loop. */
    bench_check(pthread_cond_wait(&cv, &m), "cond_wait"); /* waits forever */
    bench_check(pthread_mutex_unlock(&m), "waiter unlock");
    return NULL;
}

int main(int argc, char **argv)
{
    struct bench_args a = {.threads = 2, .iters = 1, .cs_us = 0, .seed = 1, .cs_us_set = 0};
    bench_parse(argc, argv, &a);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&signal_sent, NULL, 2), "barrier init");

    pthread_t ts, tw;
    bench_check(pthread_create(&tw, NULL, waiter_main, NULL), "create waiter");
    bench_check(pthread_create(&ts, NULL, signaler_main, NULL), "create signaler");
    bench_check(pthread_join(ts, NULL), "join signaler");
    bench_check(pthread_join(tw, NULL), "join waiter");

    pthread_barrier_destroy(&signal_sent);
    printf("lost_wakeup: completed (unexpected) seed=%llu\n", (unsigned long long)a.seed);
    printf("elapsed_ns=%llu\n", (unsigned long long)(bench_now_ns() - t0));
    return 0;
}
