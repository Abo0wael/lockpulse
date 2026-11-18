/*
 * sampler.c - Tier P /proc sampler. See sampler.h for the CSV format.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "sampler.h"

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define LP_SAMPLER_BUFSZ (1u << 20)

/* Read a whole (small) /proc file into buf, NUL-terminated.
 * Returns bytes read, or -1 with errno set. */
static ssize_t read_small_file(const char *path, char *buf, size_t cap)
{
    int fd = open(path, O_RDONLY | O_CLOEXEC);
    if (fd < 0)
        return -1;
    size_t len = 0;
    while (len + 1 < cap) {
        ssize_t n = read(fd, buf + len, cap - 1 - len);
        if (n < 0) {
            if (errno == EINTR)
                continue;
            int e = errno;
            close(fd);
            errno = e;
            return -1;
        }
        if (n == 0)
            break;
        len += (size_t)n;
    }
    close(fd);
    buf[len] = '\0';
    return (ssize_t)len;
}

/* stat: "tid (comm) S ppid pgrp session tty_nr tpgid flags minflt cminflt
 *        majflt cmajflt utime stime ...". comm may contain spaces and ')' so we
 * anchor on the LAST ')'. Fields 4..13 (10 fields) are skipped. */
static int parse_stat(const char *buf, char *state, unsigned long long *ut, unsigned long long *st)
{
    const char *rp = strrchr(buf, ')');
    if (rp == NULL || rp[1] != ' ')
        return -1;
    int n = sscanf(rp + 2, "%c %*s %*s %*s %*s %*s %*s %*s %*s %*s %*s %llu %llu", state, ut, st);
    return n == 3 ? 0 : -1;
}

static int find_ull(const char *buf, const char *key, unsigned long long *out)
{
    const char *p = strstr(buf, key);
    if (p == NULL)
        return -1;
    p += strlen(key);
    char *end = NULL;
    errno = 0;
    unsigned long long v = strtoull(p, &end, 10);
    if (end == p || errno != 0)
        return -1;
    *out = v;
    return 0;
}

/* status: keys anchored with a leading newline, because
 * "nonvoluntary_ctxt_switches" contains "voluntary_ctxt_switches". */
static int parse_status(const char *buf, unsigned long long *vcsw, unsigned long long *nvcsw)
{
    if (find_ull(buf, "\nvoluntary_ctxt_switches:", vcsw) != 0)
        return -1;
    if (find_ull(buf, "\nnonvoluntary_ctxt_switches:", nvcsw) != 0)
        return -1;
    return 0;
}

static long parse_syscall(const char *buf)
{
    if (strncmp(buf, "running", 7) == 0)
        return -1;
    char *end = NULL;
    errno = 0;
    long v = strtol(buf, &end, 10);
    if (end == buf || errno != 0)
        return -2;
    if (v == -1)
        return -3; /* kernel: blocked but not in a syscall */
    return v;
}

int lp_sampler_open(struct lp_sampler *s, pid_t pid, const char *csv_path)
{
    memset(s, 0, sizeof *s);
    s->pid = pid;
    int n = snprintf(s->task_dir, sizeof s->task_dir, "/proc/%d/task", (int)pid);
    if (n < 0 || (size_t)n >= sizeof s->task_dir)
        return -ENAMETOOLONG;

    int fd = open(csv_path, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0644);
    if (fd < 0)
        return -errno;
    s->out = fdopen(fd, "w");
    if (s->out == NULL) {
        int e = errno;
        close(fd);
        return -e;
    }
    s->outbuf = malloc(LP_SAMPLER_BUFSZ);
    if (s->outbuf != NULL)
        setvbuf(s->out, s->outbuf, _IOFBF, LP_SAMPLER_BUFSZ);
    fputs("ts_ns,tid,state,utime_ticks,stime_ticks,vcsw,nvcsw,syscall_nr\n", s->out);
    return 0;
}

void lp_sampler_tick(struct lp_sampler *s, uint64_t ts_ns)
{
    s->ticks++;
    DIR *d = opendir(s->task_dir);
    if (d == NULL)
        return; /* process already gone */

    char path[128];
    char statbuf[1024];
    char statusbuf[8192];
    char sysbuf[256];
    struct dirent *de;

    while ((de = readdir(d)) != NULL) {
        if (de->d_name[0] < '0' || de->d_name[0] > '9')
            continue;

        int n = snprintf(path, sizeof path, "%s/%s/stat", s->task_dir, de->d_name);
        if (n < 0 || (size_t)n >= sizeof path)
            continue;
        if (read_small_file(path, statbuf, sizeof statbuf) <= 0)
            continue; /* thread vanished (ENOENT/ESRCH): skip silently */

        char state = '?';
        unsigned long long ut = 0, st = 0;
        if (parse_stat(statbuf, &state, &ut, &st) != 0)
            continue;

        n = snprintf(path, sizeof path, "%s/%s/status", s->task_dir, de->d_name);
        if (n < 0 || (size_t)n >= sizeof path)
            continue;
        unsigned long long vcsw = 0, nvcsw = 0;
        if (read_small_file(path, statusbuf, sizeof statusbuf) <= 0)
            continue; /* vanished */
        if (parse_status(statusbuf, &vcsw, &nvcsw) != 0)
            continue;

        long sysnr = -2;
        n = snprintf(path, sizeof path, "%s/%s/syscall", s->task_dir, de->d_name);
        if (n > 0 && (size_t)n < sizeof path) {
            if (read_small_file(path, sysbuf, sizeof sysbuf) > 0) {
                sysnr = parse_syscall(sysbuf);
            } else {
                if (errno == ENOENT || errno == ESRCH)
                    continue; /* vanished between reads */
                s->last_syscall_errno = errno;
            }
        }
        if (sysnr == -2)
            s->syscall_unreadable++;
        else
            s->syscall_ok++;

        fprintf(s->out, "%llu,%s,%c,%llu,%llu,%llu,%llu,%ld\n",
                (unsigned long long)ts_ns, de->d_name, state, ut, st, vcsw, nvcsw, sysnr);
        s->rows++;
    }
    closedir(d);
}

int lp_sampler_close(struct lp_sampler *s)
{
    int rc = 0;
    if (s->out != NULL) {
        if (fflush(s->out) != 0)
            rc = -errno;
        if (fclose(s->out) != 0 && rc == 0)
            rc = -errno;
        s->out = NULL;
    }
    free(s->outbuf);
    s->outbuf = NULL;
    return rc;
}
