/*
 * Family:           prodcons_missing_signal       (split: train)
 * Expected outcome: HANG - the producer never signals "not empty" for the LAST
 *                   item, so consumers that are already waiting sleep forever
 *                   although an item is in the buffer.
 * Structure:        thread 0 produces K = max(N, rate*work_ms/1000) items into a
 *                   bounded buffer (capacity 8) at --rate items/s; threads 1..N-1
 *                   consume them with a correct predicate loop, doing --cs-us of
 *                   work per item. The consumer that takes item K broadcasts
 *                   "done"; nobody else ever does.
 * Forced (--force 1, default): before putting the last item the producer waits
 *                   (on a second condvar, under the buffer mutex) until all
 *                   consumers are inside pthread_cond_wait and the buffer is
 *                   empty, so the unsignalled item is never noticed.
 * Unforced (--force 0): the producer just puts the last item without a signal.
 *                   If some consumer is still busy with an earlier item it will
 *                   find the last one and finish the run; otherwise it hangs.
 * Defaults:         threads 2, cs_us 50, work_ms 400, rate 500, force 1.
 * Main joins all threads.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

#define CAPACITY 8

static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
static pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;
static pthread_cond_t consumer_waiting = PTHREAD_COND_INITIALIZER;
static long count, consumed, waiting, total_items;
static int done;
static struct bench_args A;

static void producer(struct bench_thread *t)
{
    long consumers = A.threads - 1;
    for (long i = 0; i < total_items; i++) {
        bench_think(&t->rng, A.rate);
        int last = (i == total_items - 1);
        bench_check(pthread_mutex_lock(&m), "producer lock");
        while (count == CAPACITY)
            bench_check(pthread_cond_wait(&not_full, &m), "wait not_full");
        if (last && A.force) {
            while (!(waiting == consumers && count == 0))
                bench_check(pthread_cond_wait(&consumer_waiting, &m), "wait consumer_waiting");
        }
        count++;
        if (!last)
            bench_check(pthread_cond_signal(&not_empty), "signal not_empty");
        /* BUG (intentional): no signal for the last item. */
        bench_check(pthread_mutex_unlock(&m), "producer unlock");
    }
}

static void consumer(struct bench_thread *t)
{
    for (;;) {
        bench_check(pthread_mutex_lock(&m), "consumer lock");
        while (count == 0 && !done) {
            waiting++;
            bench_check(pthread_cond_signal(&consumer_waiting), "signal consumer_waiting");
            bench_check(pthread_cond_wait(&not_empty, &m), "wait not_empty");
            waiting--;
        }
        if (count == 0 && done) {
            bench_check(pthread_mutex_unlock(&m), "consumer unlock");
            return;
        }
        count--;
        consumed++;
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
    A = (struct bench_args){.threads = 2, .cs_us = 50, .work_ms = 400, .rate = 500, .iters = 0,
                            .force = 1, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("prodcons_missing_signal", &A, 2);
    bench_print_args("prodcons_missing_signal", &A);
    total_items = A.rate * A.work_ms / 1000;
    if (total_items < A.threads)
        total_items = A.threads;

    uint64_t t0 = bench_now_ns();
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);

    if (consumed != total_items) {
        fprintf(stderr, "prodcons_missing_signal: consumed %ld of %ld\n", consumed, total_items);
        return 4;
    }
    bench_finish("prodcons_missing_signal", t0);
    free(th);
    free(ts);
    return 0;
}
