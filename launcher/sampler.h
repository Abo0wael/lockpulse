/*
 * sampler.h - Tier P: external /proc thread-state sampler.
 *
 * Nothing runs inside the target. Each tick reads, for every thread listed in
 * /proc/<pid>/task/: stat (state, utime, stime), status (voluntary /
 * nonvoluntary context switches) and syscall (current syscall number).
 *
 * CSV columns: ts_ns,tid,state,utime_ticks,stime_ticks,vcsw,nvcsw,syscall_nr
 *   ts_ns       CLOCK_MONOTONIC ns at the start of the tick (shared by all rows
 *               of that tick, so rows with equal ts_ns form one snapshot)
 *   syscall_nr  >= 0 : syscall the thread is blocked in (x86-64 numbers, 202 = futex)
 *               -1   : "running" (on a CPU, not in a syscall)
 *               -2   : /proc/<pid>/task/<tid>/syscall unreadable
 *               -3   : kernel reported -1 (blocked, but not inside a syscall)
 */
#ifndef LOCKPULSE_SAMPLER_H
#define LOCKPULSE_SAMPLER_H

#include <stdint.h>
#include <stdio.h>
#include <sys/types.h>

struct lp_sampler {
    pid_t pid;
    FILE *out;
    char *outbuf;
    char task_dir[64];
    uint64_t rows;
    uint64_t ticks;
    uint64_t syscall_ok;
    uint64_t syscall_unreadable;
    int last_syscall_errno;
};

/* Create csv_path (O_EXCL: raw data is never overwritten) and write the header.
 * Returns 0 or -errno. */
int lp_sampler_open(struct lp_sampler *s, pid_t pid, const char *csv_path);

/* One sampling pass over all threads of the target. Threads that vanish
 * between listing and reading are skipped silently. */
void lp_sampler_tick(struct lp_sampler *s, uint64_t ts_ns);

/* Flush and close. Returns 0 or -errno on write error. */
int lp_sampler_close(struct lp_sampler *s);

#endif /* LOCKPULSE_SAMPLER_H */
