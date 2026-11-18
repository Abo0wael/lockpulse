/*
 * Family:           blocked_on_io                 (split: test)
 * Expected outcome: HEALTHY (hard negative) - completes and exits 0, but for
 *                   1-2 s all readers are blocked in read() on a pipe and the
 *                   writer sleeps, so nothing happens.
 * Structure:        thread 0 writes M = max(2, rate*work_ms/1000) 16-byte
 *                   messages into one pipe at --rate messages/s (busy think),
 *                   taking a stats mutex for each write. Halfway it pauses in
 *                   nanosleep for a seeded 1000-2000 ms, then writes the rest and
 *                   closes the pipe. Threads 1..N-1 read messages until EOF; each
 *                   message is accounted under the stats mutex with --cs-us work.
 * Forcing:          none needed: writes <= PIPE_BUF are atomic, readers stop at
 *                   EOF, so the result never depends on timing.
 * Progress gap:     <= 2 s (pause capped at 2000 ms), below the 3 s watchdog.
 * Duration:         ~work_ms + 1-2 s (2-3.5 s with configs).
 * Check:            messages received == M and checksum matches, else exit 4.
 * Defaults:         threads 4, cs_us 20, work_ms 1000, rate 200.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <fcntl.h>
#include <unistd.h>

#include "bench_common.h"

#define MSG_SIZE 16

static int pipe_fd[2];
static pthread_mutex_t stats_m = PTHREAD_MUTEX_INITIALIZER;
static long total_msgs, sent, received, checksum;
static struct bench_args A;

static void write_msg(long seq)
{
    char msg[MSG_SIZE];
    memset(msg, 0, sizeof msg);
    memcpy(msg, &seq, sizeof seq);
    size_t off = 0;
    while (off < sizeof msg) {
        ssize_t n = write(pipe_fd[1], msg + off, sizeof msg - off);
        if (n < 0) {
            if (errno == EINTR)
                continue;
            perror("write");
            exit(3);
        }
        off += (size_t)n;
    }
}

/* Returns 1 with a message, 0 on EOF. */
static int read_msg(long *seq)
{
    char msg[MSG_SIZE];
    size_t off = 0;
    while (off < sizeof msg) {
        ssize_t n = read(pipe_fd[0], msg + off, sizeof msg - off);
        if (n < 0) {
            if (errno == EINTR)
                continue;
            perror("read");
            exit(3);
        }
        if (n == 0) {
            if (off == 0)
                return 0;
            fprintf(stderr, "blocked_on_io: truncated message\n");
            exit(4);
        }
        off += (size_t)n;
    }
    memcpy(seq, msg, sizeof *seq);
    return 1;
}

static void writer(struct bench_thread *t)
{
    long pause_at = total_msgs / 2;
    for (long i = 1; i <= total_msgs; i++) {
        if (i == pause_at)
            bench_sleep_ms((long)bench_rng_range(&t->rng, 1000, 2000)); /* the I/O stall */
        bench_think(&t->rng, A.rate);
        bench_check(pthread_mutex_lock(&stats_m), "writer lock");
        sent++;
        bench_check(pthread_mutex_unlock(&stats_m), "writer unlock");
        write_msg(i);
    }
    close(pipe_fd[1]); /* readers see EOF */
}

static void reader(struct bench_thread *t)
{
    long seq;
    while (read_msg(&seq)) {
        bench_check(pthread_mutex_lock(&stats_m), "reader lock");
        received++;
        checksum += seq;
        bench_cs(&t->rng, A.cs_us);
        bench_check(pthread_mutex_unlock(&stats_m), "reader unlock");
        t->ops++;
    }
}

static void *worker(void *arg)
{
    struct bench_thread *t = arg;
    bench_start_offset(&t->rng);
    if (t->idx == 0)
        writer(t);
    else
        reader(t);
    return NULL;
}

int main(int argc, char **argv)
{
    A = (struct bench_args){.threads = 4, .cs_us = 20, .work_ms = 1000, .rate = 200, .iters = 0,
                            .force = 0, .seed = 1};
    bench_parse(argc, argv, &A);
    bench_require_threads("blocked_on_io", &A, 2);
    if (A.rate < 1) {
        fprintf(stderr, "blocked_on_io: --rate must be >= 1\n");
        return 2;
    }
    bench_print_args("blocked_on_io", &A);
    total_msgs = A.rate * A.work_ms / 1000;
    if (total_msgs < 2)
        total_msgs = 2;

    if (pipe2(pipe_fd, O_CLOEXEC) != 0) {
        perror("pipe2");
        return 3;
    }
    uint64_t t0 = bench_now_ns();
    struct bench_thread *ts = bench_threads_alloc(A.threads, A.seed);
    pthread_t *th = calloc((size_t)A.threads, sizeof *th);
    if (th == NULL)
        return 3;
    bench_spawn(th, A.threads, worker, ts, sizeof *ts);
    bench_join(th, A.threads);
    close(pipe_fd[0]);

    if (received != total_msgs || checksum != total_msgs * (total_msgs + 1) / 2) {
        fprintf(stderr, "blocked_on_io: received %ld of %ld, checksum %ld\n", received, total_msgs,
                checksum);
        return 4;
    }
    bench_finish("blocked_on_io", t0);
    free(th);
    free(ts);
    return 0;
}
