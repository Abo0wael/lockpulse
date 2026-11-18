/*
 * bench_common.h - shared helpers for LockPulse benchmark programs.
 *
 * Common CLI (each program uses only what applies, the rest is accepted and
 * ignored so the launcher can pass one uniform argument set):
 *   --threads N   number of worker threads
 *   --iters N     iterations per thread
 *   --cs-us N     critical-section length in microseconds (busy work, never sleep)
 *   --seed N      RNG seed (default 1)
 *
 * Every program prints "elapsed_ns=<n>" (its own CLOCK_MONOTONIC wall time,
 * excluding process start-up) when it completes, then exits 0.
 * Errors from pthread calls exit with status 3; bad arguments exit with 2.
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

struct bench_args {
    long threads;
    long iters;
    long cs_us;
    uint64_t seed;
    int cs_us_set; /* 1 if --cs-us was given explicitly */
};

static inline uint64_t bench_now_ns(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;
}

static inline void bench_usage(const char *prog)
{
    fprintf(stderr, "usage: %s [--threads N] [--iters N] [--cs-us N] [--seed N]\n", prog);
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

/* Fill *a with defaults before calling; parsed flags override them. */
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
        if (strcmp(f, "--threads") == 0) {
            a->threads = bench_parse_long(prog, f, v);
        } else if (strcmp(f, "--iters") == 0) {
            a->iters = bench_parse_long(prog, f, v);
        } else if (strcmp(f, "--cs-us") == 0) {
            a->cs_us = bench_parse_long(prog, f, v);
            a->cs_us_set = 1;
        } else if (strcmp(f, "--seed") == 0) {
            a->seed = (uint64_t)bench_parse_long(prog, f, v);
        } else {
            fprintf(stderr, "%s: unknown option %s\n", prog, f);
            bench_usage(prog);
            exit(2);
        }
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
    uint64_t end = bench_now_ns() + ns;
    do {
        for (int i = 0; i < 256; i++) {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
        }
    } while (bench_now_ns() < end);
    return x;
}

/* Sink for busy-work results (unused attribute: not every benchmark needs it). */
static volatile uint64_t bench_sink __attribute__((unused));

#endif /* LOCKPULSE_BENCH_COMMON_H */
