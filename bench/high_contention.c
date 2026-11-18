/*
 * Family:           high_contention
 * Expected outcome: HEALTHY - completes and exits 0.
 * Forced by:        All N workers (default 16) block on a start barrier, then each
 *                   does --iters (default 10000) lock / increment / unlock on ONE
 *                   shared mutex with a tiny critical section (--cs-us, default 0 =
 *                   just the increment). Between iterations each thread does a
 *                   small seeded amount of CPU work (jitter, never sleep).
 * Check:            final counter == threads * iters, else exit 4.
 * Tier F budget:    3 records per iteration per thread (REQ, ACQ, REL) + 1; keep
 *                   iters <= 21000 to stay under 65536 records per thread.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t counter_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t start_line;
static uint64_t counter;
static struct bench_args args;

struct worker {
    pthread_t th;
    uint64_t rng;
};

static void *worker_main(void *arg)
{
    struct worker *w = (struct worker *)arg;
    uint64_t acc = 0;
    bench_barrier_wait(&start_line);
    for (long i = 0; i < args.iters; i++) {
        bench_check(pthread_mutex_lock(&counter_lock), "lock");
        counter++;
        if (args.cs_us > 0)
            acc += bench_busy_ns((uint64_t)args.cs_us * 1000ull);
        bench_check(pthread_mutex_unlock(&counter_lock), "unlock");

        /* seeded jitter outside the critical section: 0..63 cheap steps */
        uint64_t spins = bench_rng_next(&w->rng) & 63u;
        for (uint64_t k = 0; k < spins; k++)
            acc = acc * 6364136223846793005ull + 1442695040888963407ull;
    }
    bench_sink = acc;
    return NULL;
}

int main(int argc, char **argv)
{
    args = (struct bench_args){.threads = 16, .iters = 10000, .cs_us = 0, .seed = 1, .cs_us_set = 0};
    bench_parse(argc, argv, &args);
    if (args.threads < 1 || args.threads > 1024) {
        fprintf(stderr, "high_contention: --threads must be in [1, 1024]\n");
        return 2;
    }

    struct worker *ws = calloc((size_t)args.threads, sizeof *ws);
    if (ws == NULL) {
        perror("calloc");
        return 3;
    }

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&start_line, NULL, (unsigned)args.threads), "barrier init");
    for (long i = 0; i < args.threads; i++) {
        ws[i].rng = args.seed * 1000003ull + (uint64_t)i;
        bench_check(pthread_create(&ws[i].th, NULL, worker_main, &ws[i]), "create");
    }
    for (long i = 0; i < args.threads; i++)
        bench_check(pthread_join(ws[i].th, NULL), "join");
    uint64_t t1 = bench_now_ns();
    pthread_barrier_destroy(&start_line);

    uint64_t expected = (uint64_t)args.threads * (uint64_t)args.iters;
    if (counter != expected) {
        fprintf(stderr, "high_contention: counter=%llu expected=%llu\n",
                (unsigned long long)counter, (unsigned long long)expected);
        free(ws);
        return 4;
    }
    printf("high_contention: ok threads=%ld iters=%ld cs_us=%ld seed=%llu counter=%llu\n",
           args.threads, args.iters, args.cs_us, (unsigned long long)args.seed,
           (unsigned long long)counter);
    printf("elapsed_ns=%llu\n", (unsigned long long)(t1 - t0));
    free(ws);
    return 0;
}
