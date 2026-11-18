/*
 * Family:           long_critical_section
 * Expected outcome: HEALTHY (hard negative) - completes and exits 0, but for
 *                   1-2.5 s it looks like a hang from outside: one thread is
 *                   running, all others are blocked in futex on the same mutex,
 *                   and no lock is acquired or released.
 * Forced by:        The holder thread locks M BEFORE arriving at a barrier of all
 *                   --threads (default 4) threads. Waiters pass the barrier and
 *                   then call lock(M), so whenever they request M it is held. The
 *                   holder does real CPU work (busy loop, never sleep) for
 *                   --cs-us, then releases. Afterwards every thread does --iters
 *                   (default 100) short lock/increment/unlock rounds.
 * --cs-us:          if not given, drawn from the seed uniformly in [1.0, 2.5] s.
 *                   Kept below the 3 s default watchdog; configs/phase1.json still
 *                   gives this family a 4 s watchdog for margin on slow CI hosts.
 * Check:            counter == threads*iters + (threads-1), else exit 4.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "bench_common.h"

static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t holder_has_lock;
static uint64_t counter;
static struct bench_args args;

static void tail_rounds(void)
{
    for (long i = 0; i < args.iters; i++) {
        bench_check(pthread_mutex_lock(&m), "lock");
        counter++;
        bench_check(pthread_mutex_unlock(&m), "unlock");
    }
}

static void *holder_main(void *arg)
{
    (void)arg;
    bench_check(pthread_mutex_lock(&m), "holder lock");
    bench_barrier_wait(&holder_has_lock);
    bench_sink = bench_busy_ns((uint64_t)args.cs_us * 1000ull); /* long critical section */
    bench_check(pthread_mutex_unlock(&m), "holder unlock");
    tail_rounds();
    return NULL;
}

static void *waiter_main(void *arg)
{
    (void)arg;
    bench_barrier_wait(&holder_has_lock);
    bench_check(pthread_mutex_lock(&m), "waiter lock"); /* blocks until holder releases */
    counter++;
    bench_check(pthread_mutex_unlock(&m), "waiter unlock");
    tail_rounds();
    return NULL;
}

int main(int argc, char **argv)
{
    args = (struct bench_args){.threads = 4, .iters = 100, .cs_us = 0, .seed = 1, .cs_us_set = 0};
    bench_parse(argc, argv, &args);
    if (args.threads < 2 || args.threads > 1024) {
        fprintf(stderr, "long_critical_section: --threads must be in [2, 1024]\n");
        return 2;
    }
    if (!args.cs_us_set) {
        uint64_t rng = args.seed;
        args.cs_us = 1000000L + (long)(bench_rng_next(&rng) % 1500001ull);
    }

    pthread_t *ts = calloc((size_t)args.threads, sizeof *ts);
    if (ts == NULL) {
        perror("calloc");
        return 3;
    }

    uint64_t t0 = bench_now_ns();
    bench_check(pthread_barrier_init(&holder_has_lock, NULL, (unsigned)args.threads), "barrier init");
    bench_check(pthread_create(&ts[0], NULL, holder_main, NULL), "create holder");
    for (long i = 1; i < args.threads; i++)
        bench_check(pthread_create(&ts[i], NULL, waiter_main, NULL), "create waiter");
    for (long i = 0; i < args.threads; i++)
        bench_check(pthread_join(ts[i], NULL), "join");
    uint64_t t1 = bench_now_ns();
    pthread_barrier_destroy(&holder_has_lock);

    uint64_t expected = (uint64_t)args.threads * (uint64_t)args.iters + (uint64_t)(args.threads - 1);
    if (counter != expected) {
        fprintf(stderr, "long_critical_section: counter=%llu expected=%llu\n",
                (unsigned long long)counter, (unsigned long long)expected);
        free(ts);
        return 4;
    }
    printf("long_critical_section: ok threads=%ld iters=%ld cs_us=%ld seed=%llu\n",
           args.threads, args.iters, args.cs_us, (unsigned long long)args.seed);
    printf("elapsed_ns=%llu\n", (unsigned long long)(t1 - t0));
    free(ts);
    return 0;
}
