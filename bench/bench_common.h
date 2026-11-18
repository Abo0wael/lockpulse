/*
 * bench_common.h - shared helpers for LockPulse benchmark programs.
 *
 * Common CLI (every family accepts all flags; each family's header comment
 * says what they mean for it, and unused ones are ignored):
 *   --threads N   number of threads (family-specific minimum, max 63)
 *   --cs-us N     critical-section length in microseconds (busy work, never sleep)
 *   --work-ms N   length of the family's main work phase in milliseconds
 *   --rate N      operations per second per thread (family-specific unit)
 *   --iters N     family-specific count (rounds, items, locks)
 *   --seed N      RNG seed (default 1): drives start offsets and work jitter
 *   --force 0|1   hang families only: 1 = barriers/semaphores guarantee the bug,
 *                 0 = the scheduler decides (the run may or may not hang)
 *
 * Every program prints "<family>: ok ..." and "elapsed_ns=<n>" (its own
 * CLOCK_MONOTONIC wall time, excluding process start-up) when it completes,
 * then exits 0. Errors from pthread calls exit with status 3, a failed result
 * check with 4, bad arguments with 2.
 *
 * Correctness never depends on timing: interleavings that matter are forced
 * with barriers/semaphores/condition variables. Time-based loops (busy work,
 * think time, phase lengths) only shape how long things take.
 */
#ifndef LOCKPULSE_BENCH_COMMON_H
#define LOCKPULSE_BENCH_COMMON_H

#include <errno.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define BENCH_MAX_THREADS 63 /* Tier F has 64 slots; keep one for main */

enum {
    BA_THREADS = 1u << 0,
    BA_CS_US = 1u << 1,
    BA_WORK_MS = 1u << 2,
    BA_RATE = 1u << 3,
    BA_ITERS = 1u << 4,
    BA_SEED = 1u << 5,
    BA_FORCE = 1u << 6,
};

struct bench_args {
    long threads;
    long cs_us;
    long work_ms;
    long rate;
    long iters;
    long force;
    uint64_t seed;
    unsigned set; /* BA_* bits of flags given explicitly */
};

/* Sink for busy-work results (unused attribute: not every benchmark needs it). */
static volatile uint64_t bench_sink __attribute__((unused));

static inline uint64_t bench_now_ns(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;
}

static inline void bench_usage(const char *prog)
{
    fprintf(stderr,
            "usage: %s [--threads N] [--cs-us N] [--work-ms N] [--rate N] [--iters N]\n"
            "          [--seed N] [--force 0|1]\n",
            prog);
}

static inline long bench_parse_long(const char *prog, const char *flag, const char *s)
{
    char *end = NULL;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (errno != 0 || end == s || *end != '\0' || v < 0) {
        fprintf(stderr, "%s: invalid value for %s: '%s'\n", prog, flag, s);
        exit(2);
    }
    return v;
}

/* Fill *a with the family's defaults before calling; parsed flags override them. */
static inline void bench_parse(int argc, char **argv, struct bench_args *a)
{
    const char *prog = argc > 0 ? argv[0] : "bench";
    for (int i = 1; i < argc; i++) {
        const char *f = argv[i];
        if (strcmp(f, "--help") == 0 || strcmp(f, "-h") == 0) {
            bench_usage(prog);
            exit(0);
        }
        if (i + 1 >= argc) {
            fprintf(stderr, "%s: missing value for %s\n", prog, f);
            bench_usage(prog);
            exit(2);
        }
        const char *v = argv[++i];
        long n = bench_parse_long(prog, f, v);
        if (strcmp(f, "--threads") == 0) {
            a->threads = n;
            a->set |= BA_THREADS;
        } else if (strcmp(f, "--cs-us") == 0) {
            a->cs_us = n;
            a->set |= BA_CS_US;
        } else if (strcmp(f, "--work-ms") == 0) {
            a->work_ms = n;
            a->set |= BA_WORK_MS;
        } else if (strcmp(f, "--rate") == 0) {
            a->rate = n;
            a->set |= BA_RATE;
        } else if (strcmp(f, "--iters") == 0) {
            a->iters = n;
            a->set |= BA_ITERS;
        } else if (strcmp(f, "--seed") == 0) {
            a->seed = (uint64_t)n;
            a->set |= BA_SEED;
        } else if (strcmp(f, "--force") == 0) {
            if (n > 1) {
                fprintf(stderr, "%s: --force must be 0 or 1\n", prog);
                exit(2);
            }
            a->force = n;
            a->set |= BA_FORCE;
        } else {
            fprintf(stderr, "%s: unknown option %s\n", prog, f);
            bench_usage(prog);
            exit(2);
        }
    }
}

static inline void bench_require_threads(const char *family, const struct bench_args *a, long min)
{
    if (a->threads < min || a->threads > BENCH_MAX_THREADS) {
        fprintf(stderr, "%s: --threads must be in [%ld, %d]\n", family, min, BENCH_MAX_THREADS);
        exit(2);
    }
}

/* splitmix64: small, seedable, good enough for jitter and parameter draws. */
static inline uint64_t bench_rng_next(uint64_t *state)
{
    uint64_t z = (*state += 0x9E3779B97F4A7C15ull);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ull;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBull;
    return z ^ (z >> 31);
}

/* Uniform integer in [lo, hi]. */
static inline uint64_t bench_rng_range(uint64_t *state, uint64_t lo, uint64_t hi)
{
    if (hi <= lo)
        return lo;
    return lo + bench_rng_next(state) % (hi - lo + 1);
}

/* Per-thread RNG state derived from the run seed. */
static inline uint64_t bench_thread_rng(uint64_t seed, long idx)
{
    uint64_t s = seed * 0x100000001B3ull + (uint64_t)idx * 7919u + 1u;
    bench_rng_next(&s);
    return s;
}

/* base * U(1 - pct/100, 1 + pct/100) */
static inline uint64_t bench_jitter(uint64_t *rng, uint64_t base, unsigned pct)
{
    if (base == 0 || pct == 0)
        return base;
    uint64_t span = base * pct / 100u;
    return base - span + bench_rng_next(rng) % (2u * span + 1u);
}

static inline void bench_check(int rc, const char *what)
{
    if (rc != 0) {
        fprintf(stderr, "bench: %s failed: %s\n", what, strerror(rc));
        exit(3);
    }
}

static inline void bench_barrier_wait(pthread_barrier_t *b)
{
    int rc = pthread_barrier_wait(b);
    if (rc != 0 && rc != PTHREAD_BARRIER_SERIAL_THREAD)
        bench_check(rc, "pthread_barrier_wait");
}

/* Real CPU work for `ns` nanoseconds (never sleeps). Returns a value the
 * caller must consume so the loop is not optimised away. */
static inline uint64_t bench_busy_ns(uint64_t ns)
{
    uint64_t x = 0x2545F4914F6CDD1Dull;
    if (ns == 0)
        return x;
    uint64_t end = bench_now_ns() + ns;
    do {
        for (int i = 0; i < 64; i++) {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
        }
    } while (bench_now_ns() < end);
    return x;
}

/* Critical-section work: cs_us +-50 %. */
static inline void bench_cs(uint64_t *rng, long cs_us)
{
    if (cs_us > 0)
        bench_sink = bench_busy_ns(bench_jitter(rng, (uint64_t)cs_us * 1000u, 50));
}

/* Think time between operations at `rate` ops/s: busy for 1/rate +-50 %. */
static inline void bench_think(uint64_t *rng, long rate)
{
    if (rate > 0)
        bench_sink = bench_busy_ns(bench_jitter(rng, 1000000000ull / (uint64_t)rate, 50));
}

/* Seeded start offset: 0..20 ms of busy work so threads start apart. */
static inline void bench_start_offset(uint64_t *rng)
{
    bench_sink = bench_busy_ns(bench_rng_range(rng, 0, 20000000ull));
}

/* Healthy-looking lock activity for `ms` (+-25 %): lock m, count++, cs, unlock,
 * think. Rate is clamped to [10, 2000] ops/s so a phase never floods Tier F.
 * The caller's *counter must only be touched under m. */
static inline void bench_lock_phase(pthread_mutex_t *m, uint64_t *counter, long ms, long cs_us, long rate,
                                    uint64_t *rng)
{
    if (ms <= 0)
        return;
    long r = rate < 10 ? 10 : (rate > 2000 ? 2000 : rate);
    uint64_t end = bench_now_ns() + bench_jitter(rng, (uint64_t)ms * 1000000ull, 25);
    while (bench_now_ns() < end) {
        bench_check(pthread_mutex_lock(m), "phase lock");
        (*counter)++;
        bench_cs(rng, cs_us);
        bench_check(pthread_mutex_unlock(m), "phase unlock");
        bench_think(rng, r);
    }
}

/* nanosleep for ms, restarting after EINTR. */
static inline void bench_sleep_ms(long ms)
{
    struct timespec ts = {.tv_sec = ms / 1000, .tv_nsec = (ms % 1000) * 1000000L};
    while (nanosleep(&ts, &ts) != 0 && errno == EINTR) {
    }
}

static inline void bench_print_args(const char *family, const struct bench_args *a)
{
    printf("%s: threads=%ld cs_us=%ld work_ms=%ld rate=%ld iters=%ld force=%ld seed=%llu\n", family,
           a->threads, a->cs_us, a->work_ms, a->rate, a->iters, a->force, (unsigned long long)a->seed);
}

static inline void bench_finish(const char *family, uint64_t t0)
{
    printf("%s: ok\n", family);
    printf("elapsed_ns=%llu\n", (unsigned long long)(bench_now_ns() - t0));
    fflush(stdout);
}

/* Start `n` threads running fn(&args[i]); args is an array of `size`-byte elements. */
static inline void bench_spawn(pthread_t *th, long n, void *(*fn)(void *), void *args, size_t size)
{
    for (long i = 0; i < n; i++)
        bench_check(pthread_create(&th[i], NULL, fn, (char *)args + (size_t)i * size), "pthread_create");
}

static inline void bench_join(pthread_t *th, long n)
{
    for (long i = 0; i < n; i++)
        bench_check(pthread_join(th[i], NULL), "pthread_join");
}

/* Per-thread argument used by most families. */
struct bench_thread {
    long idx;
    uint64_t rng;
    uint64_t ops;
};

static inline struct bench_thread *bench_threads_alloc(long n, uint64_t seed)
{
    struct bench_thread *t = calloc((size_t)n, sizeof *t);
    if (t == NULL) {
        perror("calloc");
        exit(3);
    }
    for (long i = 0; i < n; i++) {
        t[i].idx = i;
        t[i].rng = bench_thread_rng(seed, i);
    }
    return t;
}

#endif /* LOCKPULSE_BENCH_COMMON_H */
