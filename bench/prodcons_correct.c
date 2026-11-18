/*
 * Family:           prodcons_correct              (split: validation)
 * Expected outcome: HEALTHY - completes and exits 0. Same shape as
 *                   prodcons_missing_signal, but the producer signals every item
 *                   and consumers use a predicate loop, so no wakeup is lost.
 * Structure:        thread 0 produces K = max(N, rate*work_ms/1000) items into a
 *                   bounded buffer (capacity 8) at --rate items/s (busy think);
 *                   threads 1..N-1 consume them, doing --cs-us of work per item.
 *                   The consumer that takes item K broadcasts "done".
 * Forcing:          none needed; correctness comes from the predicate loops.
 * Duration:         ~work_ms (1.5-3 s with configs); progress on every item.
 * Fixed-work mode:  --iters N sets K = N items regardless of rate/work_ms; with
 *                   --rate 0 the producer has no think time (overhead runs).
 * Output:           "ops=<items consumed>" and "ops_per_s=<...>".
 * Check:            consumed == K and the item checksum matches, else exit 4.
 * Defaults:         threads 2, cs_us 50, work_ms 2000, rate 500.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

#define CAPACITY 8

static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
static pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;
static long buf[CAPACITY];
static long head, tail, count, consumed, total_items, checksum;
static int done;
static struct bench_args A;

static void producer(struct bench_thread *t)
{
    for (long i = 1; i <= total_items; i++) {
        bench_think(&t->rng, A.rate);
        bench_check(pthread_mutex_lock(&m), "producer lock");
        while (count == CAPACITY)
            bench_check(pthread_cond_wait(&not_full, &m), "wait not_full");
        buf[tail] = i;
        tail = (tail + 1) % CAPACITY;
        count++;
        bench_check(pthread_cond_signal(&not_empty), "signal not_empty");
        bench_check(pthread_mutex_unlock(&m), "producer unlock");
    }
}

static void consumer(struct bench_thread *t)
{
    for (;;) {
        bench_check(pthread_mutex_lock(&m), "consumer lock");
        while (count == 0 && !done)
            bench_check(pthread_cond_wait(&not_empty, &m), "wait not_empty");
        if (count == 0 && done) {
            bench_check(pthread_mutex_unlock(&m), "consumer unlock");
            return;
        }
        long item = buf[head];
        head = (head + 1) % CAPACITY;
        count--;
        consumed++;
        checksum += item;
        t->ops++;
        bench_check(pthread_cond_signal(&not_full), "signal not_full");
        if (consumed == total_items) {
            done = 1;
            bench_check(pthread_cond_broadcast(&not_empty), "broadcast done");
        }
        bench_check(pthread_mutex_unlock(&m), "consumer unlock");
        bench_cs(&t->rng, A.cs_us); /* process the item outside the lock */
    }
}

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_start_offset(&t->rng);
    if (t->idx == 0)
        producer(t);
    else
        consumer(t);
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 2, .cs_us = 50, .work_ms = 2000, .rate = 500, .iters = 0,
                            .force = 0, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("prodcons_correct", &A, 2);
    if (A.iters <= 0 && A.rate < 1) {
        fprintf(stderr, "prodcons_correct: --rate must be >= 1 (or give --iters for fixed work)\n");
        return 2;
    }
    bench_print_args("prodcons_correct", &A);
    total_items = A.iters > 0 ? A.iters : A.rate * A.work_ms / 1000;
    if (total_items < A.threads)
        total_items = A.threads;

    uint64_t t0 = bench_now_ns();
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    if (consumed != total_items || checksum != total_items * (total_items + 1) / 2) {
        fprintf(stderr, "prodcons_correct: consumed %ld of %ld, checksum %ld\n", consumed, total_items,
                checksum);
        return 4;
    }
    double secs = (double)(bench_now_ns() - t0) / 1e9;
    printf("ops=%ld\nops_per_s=%.0f\n", consumed, secs > 0 ? (double)consumed / secs : 0.0);
    bench_finish("prodcons_correct", t0);
    free(th);
    free(ts);
    return 0;
}
