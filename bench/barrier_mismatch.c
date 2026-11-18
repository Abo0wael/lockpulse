/*
 * Family:           barrier_mismatch              (split: validation)
 * Expected outcome: HANG - a barrier sized for N threads, but fewer arrive:
 *                   the remaining threads wait in pthread_barrier_wait forever.
 * Structure:        N = --threads threads run up to R = --iters rounds; each
 *                   round is (work_ms/R ms of lock activity on mutex W) followed
 *                   by pthread_barrier_wait on an N-party barrier.
 * Forced (--force 1, default): a seeded victim thread leaves after a seeded
 *                   round in [R/4, 3R/4] (the "early exit" bug); the others block
 *                   at the next barrier for good.
 * Unforced (--force 0): the round limit is a shared variable that thread 0
 *                   lowers right after passing a seeded barrier (an unsynchronized
 *                   termination condition). Threads that read the limit before
 *                   the store run one more round and wait for thread 0, which has
 *                   left; if every thread reads it after the store, all leave
 *                   together and the run finishes. --cs-us of busy work before
 *                   the store widens the window.
 * Defaults:         threads 4, cs_us 0, work_ms 600, rate 200, iters 40, force 1.
 * Main joins all threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <stdatomic.h>

#include "bench_common.h"

static pthread_barrier_t round_barrier;
static pthread_mutex_t lock_w = PTHREAD_MUTEX_INITIALIZER;
static uint64_t work_count;
static _Atomic long round_limit;
static long victim, victim_round, change_round;
static struct bench_args A;

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    long per_round_ms = A.work_ms / (A.iters > 0 ? A.iters : 1);
    bench_start_offset(&t->rng);

    for (long r = 0; r < atomic_load_explicit(&round_limit, memory_order_relaxed); r++) {
        if (A.force && t->idx == victim && r == victim_round)
            return NULL; /* BUG (intentional): leaves without telling the barrier */
        bench_lock_phase(&lock_w, &work_count, per_round_ms, 0, A.rate, &t->rng);
        bench_barrier_wait(&round_barrier);
        if (!A.force && t->idx == 0 && r == change_round) {
            bench_cs(&t->rng, A.cs_us);
            /* BUG (intentional): unsynchronized change of the termination condition */
            atomic_store_explicit(&round_limit, r + 1, memory_order_relaxed);
        }
    }
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 4, .cs_us = 0, .work_ms = 600, .rate = 200, .iters = 40,
                            .force = 1, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("barrier_mismatch", &A, 2);
    if (A.iters < 4) {
        fprintf(stderr, "barrier_mismatch: --iters must be >= 4\n");
        return 2;
    }
    bench_print_args("barrier_mismatch", &A);

    uint64_t rng = bench_thread_rng(A.seed, 1000);
    victim = (long)bench_rng_range(&rng, 0, (uint64_t)A.threads - 1);
    victim_round = (long)bench_rng_range(&rng, (uint64_t)A.iters / 4, (uint64_t)(3 * A.iters) / 4);
    change_round = (long)bench_rng_range(&rng, (uint64_t)A.iters / 4, (uint64_t)(3 * A.iters) / 4);
    atomic_store(&round_limit, A.iters);

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&round_barrier, NULL, (unsigned)A.threads), "barrier init");
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    bench_finish("barrier_mismatch", t0);
    free(th);
    free(ts);
    return 0;
}
