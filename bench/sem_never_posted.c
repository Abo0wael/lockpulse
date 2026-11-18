/*
 * Family:           sem_never_posted              (split: test)
 * Expected outcome: HANG - workers block in sem_wait on a semaphore whose
 *                   poster bailed out (thread exited) before posting everything.
 * Structure:        thread 0 is the poster, threads 1..N-1 are workers that each
 *                   consume Q = --iters items: sem_wait(items), then process the
 *                   item under mutex S for --cs-us. The poster posts W*Q items,
 *                   spread over --work-ms (seeded jitter).
 * Forced (--force 1, default): the poster "crashes out" (returns from its
 *                   thread) just before a seeded item in [K/3, 2K/3].
 * Unforced (--force 0): before each post the poster does
 *                   pthread_mutex_trylock(S) and bails out if it is busy (an
 *                   error path taken under contention). Whether that ever
 *                   happens depends on how worker processing overlaps the posts;
 *                   if it never does, all items are posted and the run finishes.
 * Defaults:         threads 3, cs_us 100, work_ms 600, rate 0, iters 30, force 1.
 * Main joins all threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <semaphore.h>

#include "bench_common.h"

static sem_t items;
static pthread_mutex_t state_m = PTHREAD_MUTEX_INITIALIZER;
static long processed, total_items, bail_at;
static struct bench_args A;

static void poster(struct bench_thread *t)
{
    uint64_t gap_ns = (uint64_t)A.work_ms * 1000000ull / (uint64_t)total_items;
    for (long i = 0; i < total_items; i++) {
        bench_sink = bench_busy_ns(bench_jitter(&t->rng, gap_ns, 50));
        if (A.force && i == bail_at) {
            fprintf(stderr, "sem_never_posted: poster bails out at item %ld of %ld\n", i, total_items);
            return; /* BUG (intentional): exits without posting the rest */
        }
        if (!A.force) {
            int rc = pthread_mutex_trylock(&state_m);
            if (rc == EBUSY) {
                fprintf(stderr, "sem_never_posted: poster bails out (busy) at item %ld\n", i);
                return; /* BUG (intentional): error path on contention */
            }
            bench_check(rc, "poster trylock");
            bench_check(pthread_mutex_unlock(&state_m), "poster unlock");
        }
        if (sem_post(&items) != 0) {
            perror("sem_post");
            exit(3);
        }
    }
}

static void worker_loop(struct bench_thread *t)
{
    for (long q = 0; q < A.iters; q++) {
        while (sem_wait(&items) != 0) {
            if (errno != EINTR) {
                perror("sem_wait");
                exit(3);
            }
        }
        bench_check(pthread_mutex_lock(&state_m), "worker lock");
        processed++;
        t->ops++;
        bench_cs(&t->rng, A.cs_us);
        bench_check(pthread_mutex_unlock(&state_m), "worker unlock");
    }
}

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_start_offset(&t->rng);
    if (t->idx == 0)
        poster(t);
    else
        worker_loop(t);
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 3, .cs_us = 100, .work_ms = 600, .rate = 0, .iters = 30,
                            .force = 1, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("sem_never_posted", &A, 2);
    if (A.iters < 1) {
        fprintf(stderr, "sem_never_posted: --iters must be >= 1\n");
        return 2;
    }
    bench_print_args("sem_never_posted", &A);
    total_items = (A.threads - 1) * A.iters;
    uint64_t rng = bench_thread_rng(A.seed, 1000);
    bail_at = (long)bench_rng_range(&rng, (uint64_t)total_items / 3, (uint64_t)(2 * total_items) / 3);

    if (sem_init(&items, 0, 0) != 0) {
        perror("sem_init");
        return 3;
    }
    uint64_t t0 = bench_now_ns();
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    if (processed != total_items) {
        fprintf(stderr, "sem_never_posted: processed %ld of %ld\n", processed, total_items);
        return 4;
    }
    bench_finish("sem_never_posted", t0);
    sem_destroy(&items);
    free(th);
    free(ts);
    return 0;
}
