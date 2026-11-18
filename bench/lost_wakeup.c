/*
 * Family:           lost_wakeup                   (split: train)
 * Expected outcome: HANG - lost wakeup (no lock cycle; nobody holds a mutex
 *                   while hung; the waiters sit in pthread_cond_wait).
 * Structure:        thread 0 is the signaler, threads 1..N-1 are waiters. All
 *                   run a healthy lock phase on mutex W first (--work-ms,
 *                   --cs-us, --rate). The signaler then sends N-1 single
 *                   pthread_cond_signal calls (each under m). Each waiter locks m
 *                   and calls pthread_cond_wait WITHOUT a predicate loop - the bug.
 * Forced (--force 1, default): the signaler sends all signals and only then
 *                   arrives at a barrier of all N threads; waiters pass that
 *                   barrier before waiting, so every signal is lost.
 * Unforced (--force 0): no barrier; whether a waiter is already waiting when a
 *                   signal arrives depends on the (jittered) phase lengths and the
 *                   scheduler. If every signal finds a waiter, the run finishes.
 * Defaults:         threads 2, cs_us 0, work_ms 300, rate 200, force 1.
 * Note:             under the shim, cond_wait shows as COND_WAIT_ENTER plus an
 *                   implicit MUTEX_REL; the waiters are pending in COND_WAIT_ENTER.
 * Main joins all threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t cv = PTHREAD_COND_INITIALIZER;
static pthread_mutex_t lock_w = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t signals_sent;
static uint64_t warm_count;
static struct bench_args A;

static void *signaler(struct bench_thread *t)
{
    for (long k = 1; k < A.threads; k++) {
        bench_check(pthread_mutex_lock(&m), "signaler lock");
        bench_check(pthread_cond_signal(&cv), "cond_signal"); /* lost if nobody waits */
        bench_check(pthread_mutex_unlock(&m), "signaler unlock");
        bench_think(&t->rng, A.rate);
    }
    if (A.force)
        bench_barrier_wait(&signals_sent);
    return NULL;
}

static void *waiter(struct bench_thread *t)
{
    (void)t;
    if (A.force)
        bench_barrier_wait(&signals_sent); /* all signals are already gone */
    bench_check(pthread_mutex_lock(&m), "waiter lock");
    /* BUG (intentional): no `while (!ready)` predicate loop. */
    bench_check(pthread_cond_wait(&cv, &m), "cond_wait");
    bench_check(pthread_mutex_unlock(&m), "waiter unlock");
    return NULL;
}

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_start_offset(&t->rng);
    bench_lock_phase(&lock_w, &warm_count, A.work_ms, A.cs_us, A.rate, &t->rng);
    return t->idx == 0 ? signaler(t) : waiter(t);
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 2, .cs_us = 0, .work_ms = 300, .rate = 200, .iters = 0,
                            .force = 1, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("lost_wakeup", &A, 2);
    bench_print_args("lost_wakeup", &A);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&signals_sent, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    bench_finish("lost_wakeup", t0);
    free(th);
    free(ts);
    return 0;
}
