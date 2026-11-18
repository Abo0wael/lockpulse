/*
 * launcher.c - lp-run: run one benchmark under LockPulse telemetry.
 *
 *   lp-run --family NAME --run-id ID [--tier P|F|PF] [--interval-ms 5]
 *          [--watchdog-ms 3000] [--max-ms 10000] [--data-dir data/raw]
 *          [--shim PATH] [--tag KEY=VALUE]... -- <benchmark> [bench args]
 *
 * --tag stores free-form run attributes (e.g. split=train, config_id=c1) in
 * the metadata "tags" object; at most LP_MAX_TAGS.
 *
 * Outputs (under --data-dir, default data/raw; never overwritten):
 *   tierP/<run_id>.csv   Tier P samples (tier P or PF)
 *   tierF/<run_id>.bin   Tier F trace buffer (tier F or PF)
 *   meta/<run_id>.json   run metadata
 *
 * Exit status of lp-run: 0 if the run was recorded (whatever the benchmark
 * did - see exit_reason in the metadata), 1 on launcher errors, 2 on bad usage.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <errno.h>
#include <fcntl.h>
#include <getopt.h>
#include <gnu/libc-version.h>
#include <limits.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/utsname.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#include "sampler.h"
#include "tracebuf.h"
#include "watchdog.h"

#define LP_META_SCHEMA_VERSION 2
#define LP_MAX_WARNINGS 8
#define LP_MAX_TAGS 16

/* GitHub-hosted runner identification, recorded when present. */
static const char *const k_runner_env[] = {
    "ImageOS", "ImageVersion", "RUNNER_NAME", "RUNNER_OS", "RUNNER_ARCH",
    "RUNNER_ENVIRONMENT", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "GITHUB_SHA", "GITHUB_WORKFLOW",
};

struct opts {
    const char *tags[LP_MAX_TAGS];
    int ntags;
    const char *family;
    const char *run_id;
    const char *tier;
    int tier_p;
    int tier_f;
    long interval_ms;
    long watchdog_ms;
    long max_ms;
    const char *data_dir;
    const char *shim;
    int bench_argc;
    char **bench_argv;
};

static const char *g_warnings[LP_MAX_WARNINGS];
static char g_warnbuf[LP_MAX_WARNINGS][256];
static int g_nwarnings;

static void add_warning(const char *msg)
{
    if (g_nwarnings >= LP_MAX_WARNINGS)
        return;
    snprintf(g_warnbuf[g_nwarnings], sizeof g_warnbuf[g_nwarnings], "%s", msg);
    g_warnings[g_nwarnings] = g_warnbuf[g_nwarnings];
    g_nwarnings++;
}

static uint64_t now_ns(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;
}

static void usage(FILE *f)
{
    fprintf(f,
            "usage: lp-run --family NAME --run-id ID [--tier P|F|PF] [--interval-ms 5]\n"
            "              [--watchdog-ms 3000] [--max-ms 10000] [--data-dir data/raw]\n"
            "              [--shim PATH] [--tag KEY=VALUE]... -- <benchmark> [bench args]\n");
}

static int parse_pos_long(const char *s, long *out)
{
    char *end = NULL;
    errno = 0;
    long v = strtol(s, &end, 10);
    if (errno != 0 || end == s || *end != '\0' || v <= 0)
        return -1;
    *out = v;
    return 0;
}

/* run ids and family names become file names: keep them boring. */
static int safe_name(const char *s)
{
    if (s == NULL || s[0] == '\0' || strlen(s) > 128)
        return 0;
    for (const char *p = s; *p; p++) {
        char c = *p;
        int ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
                 c == '_' || c == '-' || c == '.';
        if (!ok)
            return 0;
    }
    return s[0] != '.';
}

static int parse_opts(int argc, char **argv, struct opts *o)
{
    static const struct option longopts[] = {
        {"family", required_argument, NULL, 'f'},
        {"run-id", required_argument, NULL, 'r'},
        {"tier", required_argument, NULL, 't'},
        {"interval-ms", required_argument, NULL, 'i'},
        {"watchdog-ms", required_argument, NULL, 'w'},
        {"max-ms", required_argument, NULL, 'm'},
        {"data-dir", required_argument, NULL, 'd'},
        {"shim", required_argument, NULL, 's'},
        {"tag", required_argument, NULL, 'T'},
        {"help", no_argument, NULL, 'h'},
        {NULL, 0, NULL, 0},
    };

    memset(o, 0, sizeof *o);
    o->tier = "PF";
    o->interval_ms = 5;
    o->watchdog_ms = 3000;
    o->max_ms = 10000;
    o->data_dir = "data/raw";

    int c;
    /* leading '+': stop at the first non-option (the benchmark path) */
    while ((c = getopt_long(argc, argv, "+h", longopts, NULL)) != -1) {
        switch (c) {
        case 'f': o->family = optarg; break;
        case 'r': o->run_id = optarg; break;
        case 't': o->tier = optarg; break;
        case 'd': o->data_dir = optarg; break;
        case 's': o->shim = optarg; break;
        case 'T': {
            const char *eq = strchr(optarg, '=');
            if (eq == NULL || eq == optarg || o->ntags >= LP_MAX_TAGS) {
                fprintf(stderr, "lp-run: bad --tag '%s' (KEY=VALUE, at most %d)\n", optarg, LP_MAX_TAGS);
                return -1;
            }
            o->tags[o->ntags++] = optarg;
            break;
        }
        case 'i':
            if (parse_pos_long(optarg, &o->interval_ms) != 0) {
                fprintf(stderr, "lp-run: bad --interval-ms\n");
                return -1;
            }
            break;
        case 'w':
            if (parse_pos_long(optarg, &o->watchdog_ms) != 0) {
                fprintf(stderr, "lp-run: bad --watchdog-ms\n");
                return -1;
            }
            break;
        case 'm':
            if (parse_pos_long(optarg, &o->max_ms) != 0) {
                fprintf(stderr, "lp-run: bad --max-ms\n");
                return -1;
            }
            break;
        case 'h':
            usage(stdout);
            exit(0);
        default:
            return -1;
        }
    }

    if (!safe_name(o->family)) {
        fprintf(stderr, "lp-run: --family is required ([A-Za-z0-9_.-], not starting with '.')\n");
        return -1;
    }
    if (!safe_name(o->run_id)) {
        fprintf(stderr, "lp-run: --run-id is required ([A-Za-z0-9_.-], not starting with '.')\n");
        return -1;
    }
    if (strcmp(o->tier, "P") == 0) {
        o->tier_p = 1;
    } else if (strcmp(o->tier, "F") == 0) {
        o->tier_f = 1;
    } else if (strcmp(o->tier, "PF") == 0 || strcmp(o->tier, "FP") == 0) {
        o->tier = "PF";
        o->tier_p = 1;
        o->tier_f = 1;
    } else {
        fprintf(stderr, "lp-run: --tier must be P, F or PF\n");
        return -1;
    }
    if (optind >= argc) {
        fprintf(stderr, "lp-run: missing benchmark after --\n");
        return -1;
    }
    o->bench_argc = argc - optind;
    o->bench_argv = &argv[optind];
    return 0;
}

static int mkdir_one(const char *path)
{
    if (mkdir(path, 0755) == 0 || errno == EEXIST)
        return 0;
    return -errno;
}

static int join_path(char *out, size_t cap, const char *a, const char *b, const char *c)
{
    int n = snprintf(out, cap, "%s/%s%s", a, b, c);
    if (n < 0 || (size_t)n >= cap)
        return -ENAMETOOLONG;
    return 0;
}

/* Default shim location: liblockpulse.so next to the lp-run executable. */
static int default_shim_path(char *out, size_t cap)
{
    char exe[PATH_MAX];
    ssize_t n = readlink("/proc/self/exe", exe, sizeof exe - 1);
    if (n <= 0)
        return -errno;
    exe[n] = '\0';
    char *slash = strrchr(exe, '/');
    if (slash == NULL)
        return -EINVAL;
    *slash = '\0';
    return join_path(out, cap, exe, "liblockpulse.so", "");
}

/* ---------- minimal JSON writer ---------- */

static void json_str(FILE *f, const char *s)
{
    if (s == NULL) {
        fputs("null", f);
        return;
    }
    fputc('"', f);
    for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
        switch (*p) {
        case '"': fputs("\\\"", f); break;
        case '\\': fputs("\\\\", f); break;
        case '\n': fputs("\\n", f); break;
        case '\r': fputs("\\r", f); break;
        case '\t': fputs("\\t", f); break;
        default:
            if (*p < 0x20)
                fprintf(f, "\\u%04x", (unsigned)*p);
            else
                fputc(*p, f);
        }
    }
    fputc('"', f);
}

static void json_u64(FILE *f, uint64_t v)
{
    fprintf(f, "%llu", (unsigned long long)v);
}

static void read_first_line(const char *path, char *buf, size_t cap)
{
    buf[0] = '\0';
    FILE *f = fopen(path, "re");
    if (f == NULL)
        return;
    if (fgets(buf, (int)cap, f) == NULL)
        buf[0] = '\0';
    fclose(f);
    size_t n = strlen(buf);
    while (n > 0 && (buf[n - 1] == '\n' || buf[n - 1] == '\r'))
        buf[--n] = '\0';
}

struct run_result {
    pid_t pid;
    uint64_t start_ns;
    uint64_t exec_ns;
    uint64_t end_ns;
    uint64_t kill_ns;
    const char *killed_by; /* NULL, "watchdog", "max_time" */
    char exit_reason[64];
    int exit_code;   /* -1 if not exited */
    int term_signal; /* -1 if not signaled */
    int exec_errno;  /* 0 if exec succeeded */
    uint64_t last_progress_observed_ns;
    uint64_t progress_counter;
    uint32_t overflow;
    uint64_t dropped;
    uint32_t threads_seen;
    int tierf_mapped;
    /* lp-run's own CPU usage (sampler + watchdog), measured at the end of the run */
    int cpu_ok;
    unsigned long long cpu_utime_ticks, cpu_stime_ticks;
    long clk_tck;
    uint64_t ru_user_us, ru_sys_us;
};

/* CPU used by this launcher process (not the reaped child): utime/stime from
 * /proc/self/stat (fields 14/15, clock ticks) plus getrusage(RUSAGE_SELF) for
 * microsecond resolution. */
static void measure_self_cpu(struct run_result *r)
{
    char buf[1024];
    FILE *f = fopen("/proc/self/stat", "re");
    if (f != NULL) {
        if (fgets(buf, sizeof buf, f) != NULL) {
            const char *rp = strrchr(buf, ')');
            if (rp != NULL && rp[1] == ' ' &&
                sscanf(rp + 2, "%*c %*s %*s %*s %*s %*s %*s %*s %*s %*s %*s %llu %llu",
                       &r->cpu_utime_ticks, &r->cpu_stime_ticks) == 2)
                r->cpu_ok = 1;
        }
        fclose(f);
    }
    r->clk_tck = sysconf(_SC_CLK_TCK);
    struct rusage ru;
    if (getrusage(RUSAGE_SELF, &ru) == 0) {
        r->ru_user_us = (uint64_t)ru.ru_utime.tv_sec * 1000000ull + (uint64_t)ru.ru_utime.tv_usec;
        r->ru_sys_us = (uint64_t)ru.ru_stime.tv_sec * 1000000ull + (uint64_t)ru.ru_stime.tv_usec;
    }
}

static int write_meta(const char *path, const struct opts *o, const struct run_result *r,
                      const struct lp_sampler *s, const char *p_path, const char *f_path)
{
    int fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0644);
    if (fd < 0)
        return -errno;
    FILE *f = fdopen(fd, "w");
    if (f == NULL) {
        int e = errno;
        close(fd);
        return -e;
    }

    struct utsname u;
    int have_uname = uname(&u) == 0;
    char yama[64];
    read_first_line("/proc/sys/kernel/yama/ptrace_scope", yama, sizeof yama);

    fprintf(f, "{\n  \"meta_schema_version\": %d,\n", LP_META_SCHEMA_VERSION);
    fputs("  \"run_id\": ", f);
    json_str(f, o->run_id);
    fputs(",\n  \"family\": ", f);
    json_str(f, o->family);

    fputs(",\n  \"bench_argv\": [", f);
    for (int i = 0; i < o->bench_argc; i++) {
        if (i)
            fputs(", ", f);
        json_str(f, o->bench_argv[i]);
    }
    fputs("]", f);

    /* params: every "--key value" pair of the benchmark argv; seed pulled out */
    const char *seed = NULL;
    fputs(",\n  \"params\": {", f);
    int first = 1;
    for (int i = 1; i + 1 < o->bench_argc; i++) {
        const char *k = o->bench_argv[i];
        if (strncmp(k, "--", 2) != 0)
            continue;
        const char *v = o->bench_argv[i + 1];
        if (strcmp(k, "--seed") == 0)
            seed = v;
        if (!first)
            fputs(", ", f);
        first = 0;
        json_str(f, k + 2);
        fputs(": ", f);
        json_str(f, v);
        i++;
    }
    fputs("}", f);
    fputs(",\n  \"seed\": ", f);
    json_str(f, seed);

    fputs(",\n  \"tier\": ", f);
    json_str(f, o->tier);
    fprintf(f, ",\n  \"interval_ms\": %ld,\n  \"watchdog_ms\": %ld,\n  \"max_ms\": %ld", o->interval_ms,
            o->watchdog_ms, o->max_ms);
    fprintf(f, ",\n  \"pid\": %d", (int)r->pid);
    fputs(",\n  \"clock\": \"CLOCK_MONOTONIC_ns\"", f);
    fputs(",\n  \"start_ns\": ", f);
    json_u64(f, r->start_ns);
    fputs(",\n  \"exec_ns\": ", f);
    json_u64(f, r->exec_ns);
    fputs(",\n  \"end_ns\": ", f);
    json_u64(f, r->end_ns);
    fprintf(f, ",\n  \"duration_ms\": %.3f", (double)(r->end_ns - r->start_ns) / 1e6);

    fputs(",\n  \"exit_reason\": ", f);
    json_str(f, r->exit_reason);
    fprintf(f, ",\n  \"exit_code\": %d,\n  \"term_signal\": %d", r->exit_code, r->term_signal);
    fputs(",\n  \"killed_by\": ", f);
    json_str(f, r->killed_by);
    fputs(",\n  \"kill_ns\": ", f);
    if (r->killed_by)
        json_u64(f, r->kill_ns);
    else
        fputs("null", f);
    fprintf(f, ",\n  \"exec_errno\": %d", r->exec_errno);

    fputs(",\n  \"tags\": {", f);
    for (int i = 0; i < o->ntags; i++) {
        const char *eq = strchr(o->tags[i], '=');
        char key[128];
        size_t klen = (size_t)(eq - o->tags[i]);
        if (klen >= sizeof key)
            klen = sizeof key - 1;
        memcpy(key, o->tags[i], klen);
        key[klen] = '\0';
        if (i)
            fputs(", ", f);
        json_str(f, key);
        fputs(": ", f);
        json_str(f, eq + 1);
    }
    fputs("}", f);

    uint64_t wall_ns = r->end_ns > r->start_ns ? r->end_ns - r->start_ns : 1;
    fputs(",\n  \"launcher_cpu\": {\"utime_ticks\": ", f);
    if (r->cpu_ok)
        fprintf(f, "%llu, \"stime_ticks\": %llu", r->cpu_utime_ticks, r->cpu_stime_ticks);
    else
        fputs("null, \"stime_ticks\": null", f);
    fprintf(f, ", \"clk_tck\": %ld, \"ru_user_us\": ", r->clk_tck);
    json_u64(f, r->ru_user_us);
    fputs(", \"ru_sys_us\": ", f);
    json_u64(f, r->ru_sys_us);
    fprintf(f, ", \"cpu_pct\": %.3f}",
            100.0 * (double)(r->ru_user_us + r->ru_sys_us) * 1000.0 / (double)wall_ns);

    fputs(",\n  \"tierP\": ", f);
    if (o->tier_p) {
        fputs("{\"path\": ", f);
        json_str(f, p_path);
        fputs(", \"samples\": ", f);
        json_u64(f, s->rows);
        fputs(", \"ticks\": ", f);
        json_u64(f, s->ticks);
        fputs(", \"syscall_reads_ok\": ", f);
        json_u64(f, s->syscall_ok);
        fputs(", \"syscall_reads_unreadable\": ", f);
        json_u64(f, s->syscall_unreadable);
        fputs("}", f);
    } else {
        fputs("null", f);
    }

    fputs(",\n  \"tierF\": ", f);
    if (o->tier_f) {
        fputs("{\"path\": ", f);
        json_str(f, f_path);
        fprintf(f, ", \"mapped\": %s", r->tierf_mapped ? "true" : "false");
        fputs(", \"progress_counter\": ", f);
        json_u64(f, r->progress_counter);
        fputs(", \"last_progress_observed_ns\": ", f);
        json_u64(f, r->last_progress_observed_ns);
        fprintf(f, ", \"overflow\": %s, \"overflow_flags\": %u", r->overflow ? "true" : "false",
                (unsigned)r->overflow);
        fputs(", \"dropped_records\": ", f);
        json_u64(f, r->dropped);
        fprintf(f, ", \"threads_seen\": %u", (unsigned)r->threads_seen);
        fprintf(f, ", \"max_threads\": %u, \"records_per_thread\": %u}", LP_DEFAULT_MAX_THREADS,
                LP_DEFAULT_RECORDS_PER_THREAD);
    } else {
        fputs("null", f);
    }

    fputs(",\n  \"env\": {\"uname\": ", f);
    if (have_uname) {
        fputs("{\"sysname\": ", f);
        json_str(f, u.sysname);
        fputs(", \"release\": ", f);
        json_str(f, u.release);
        fputs(", \"version\": ", f);
        json_str(f, u.version);
        fputs(", \"machine\": ", f);
        json_str(f, u.machine);
        fputs("}", f);
    } else {
        fputs("null", f);
    }
#ifdef __VERSION__
    fputs(", \"gcc_version\": ", f);
    json_str(f, __VERSION__);
#else
    fputs(", \"gcc_version\": null", f);
#endif
    fputs(", \"glibc_version\": ", f);
    json_str(f, gnu_get_libc_version());
    fputs(", \"yama_ptrace_scope\": ", f);
    json_str(f, yama[0] ? yama : NULL);
    fputs(", \"runner\": {", f);
    int nr = 0;
    for (size_t i = 0; i < sizeof k_runner_env / sizeof k_runner_env[0]; i++) {
        const char *v = getenv(k_runner_env[i]);
        if (v == NULL)
            continue;
        if (nr++)
            fputs(", ", f);
        json_str(f, k_runner_env[i]);
        fputs(": ", f);
        json_str(f, v);
    }
    fputs("}}", f);

    fputs(",\n  \"warnings\": [", f);
    for (int i = 0; i < g_nwarnings; i++) {
        if (i)
            fputs(", ", f);
        json_str(f, g_warnings[i]);
    }
    fputs("]\n}\n", f);

    int rc = 0;
    if (fflush(f) != 0)
        rc = -errno;
    if (fclose(f) != 0 && rc == 0)
        rc = -errno;
    return rc;
}

static void decode_status(int status, struct run_result *r)
{
    if (WIFEXITED(status)) {
        r->exit_code = WEXITSTATUS(status);
        r->term_signal = -1;
    } else if (WIFSIGNALED(status)) {
        r->exit_code = -1;
        r->term_signal = WTERMSIG(status);
    }

    if (r->killed_by != NULL && WIFSIGNALED(status) && WTERMSIG(status) == SIGKILL) {
        snprintf(r->exit_reason, sizeof r->exit_reason, "%s",
                 strcmp(r->killed_by, "watchdog") == 0 ? "watchdog_kill" : "max_time_kill");
        return;
    }
    r->killed_by = NULL; /* child finished on its own just before our kill */
    if (WIFEXITED(status)) {
        if (r->exit_code == 0)
            snprintf(r->exit_reason, sizeof r->exit_reason, "exited_ok");
        else
            snprintf(r->exit_reason, sizeof r->exit_reason, "exited_error(%d)", r->exit_code);
    } else if (WIFSIGNALED(status)) {
        snprintf(r->exit_reason, sizeof r->exit_reason, "signaled(%d)", r->term_signal);
    } else {
        snprintf(r->exit_reason, sizeof r->exit_reason, "unknown(0x%x)", (unsigned)status);
    }
}

int main(int argc, char **argv)
{
    struct opts o;
    if (parse_opts(argc, argv, &o) != 0) {
        usage(stderr);
        return 2;
    }

    char dir_p[PATH_MAX], dir_f[PATH_MAX], dir_m[PATH_MAX];
    char p_path[PATH_MAX], f_path[PATH_MAX], m_path[PATH_MAX];
    if (join_path(dir_p, sizeof dir_p, o.data_dir, "tierP", "") || join_path(dir_f, sizeof dir_f, o.data_dir, "tierF", "") ||
        join_path(dir_m, sizeof dir_m, o.data_dir, "meta", "") ||
        join_path(p_path, sizeof p_path, dir_p, o.run_id, ".csv") ||
        join_path(f_path, sizeof f_path, dir_f, o.run_id, ".bin") ||
        join_path(m_path, sizeof m_path, dir_m, o.run_id, ".json")) {
        fprintf(stderr, "lp-run: path too long\n");
        return 1;
    }
    if (mkdir_one(o.data_dir) || mkdir_one(dir_p) || mkdir_one(dir_f) || mkdir_one(dir_m)) {
        fprintf(stderr, "lp-run: cannot create data directories under %s: %s\n", o.data_dir, strerror(errno));
        return 1;
    }
    if (access(m_path, F_OK) == 0) {
        fprintf(stderr, "lp-run: run %s already exists (raw data is immutable)\n", o.run_id);
        return 1;
    }
    if (access(o.bench_argv[0], X_OK) != 0) {
        fprintf(stderr, "lp-run: benchmark %s is not executable: %s\n", o.bench_argv[0], strerror(errno));
        return 1;
    }

    /* Tier F setup: shim path + trace file, created before fork so the
     * watchdog can map it immediately. */
    char shim_abs[PATH_MAX] = "";
    char trace_abs[PATH_MAX] = "";
    if (o.tier_f) {
        char shim_guess[PATH_MAX];
        const char *shim = o.shim;
        if (shim == NULL) {
            if (default_shim_path(shim_guess, sizeof shim_guess) != 0) {
                fprintf(stderr, "lp-run: cannot locate liblockpulse.so; pass --shim\n");
                return 1;
            }
            shim = shim_guess;
        }
        if (realpath(shim, shim_abs) == NULL) {
            fprintf(stderr, "lp-run: shim %s: %s\n", shim, strerror(errno));
            return 1;
        }
        /* LD_PRELOAD splits on spaces and colons; it cannot carry such paths. */
        if (strpbrk(shim_abs, " :") != NULL) {
            fprintf(stderr, "lp-run: shim path '%s' contains a space or ':' which LD_PRELOAD cannot "
                            "handle; move the repo to a path without spaces\n", shim_abs);
            return 1;
        }
        int rc = lp_tb_create(f_path, LP_DEFAULT_MAX_THREADS, LP_DEFAULT_RECORDS_PER_THREAD);
        if (rc != 0) {
            fprintf(stderr, "lp-run: cannot create trace %s: %s\n", f_path, strerror(-rc));
            return 1;
        }
        if (realpath(f_path, trace_abs) == NULL) {
            fprintf(stderr, "lp-run: realpath %s: %s\n", f_path, strerror(errno));
            return 1;
        }
    }

    struct run_result r;
    memset(&r, 0, sizeof r);
    r.exit_code = -1;
    r.term_signal = -1;

    /* exec handshake: the CLOEXEC pipe closes on successful exec; on failure
     * the child writes errno into it. */
    int pfd[2];
    if (pipe2(pfd, O_CLOEXEC) != 0) {
        perror("lp-run: pipe2");
        return 1;
    }
    fflush(NULL);

    r.start_ns = now_ns();
    pid_t pid = fork();
    if (pid < 0) {
        perror("lp-run: fork");
        return 1;
    }
    if (pid == 0) {
        close(pfd[0]);
        prctl(PR_SET_PDEATHSIG, SIGKILL); /* never outlive the launcher */
        unsetenv("LP_TRACE_PATH");
        if (o.tier_f) {
            setenv("LD_PRELOAD", shim_abs, 1);
            setenv("LP_TRACE_PATH", trace_abs, 1);
        }
        execv(o.bench_argv[0], o.bench_argv);
        int e = errno;
        ssize_t w = write(pfd[1], &e, sizeof e);
        (void)w;
        _exit(127);
    }
    r.pid = pid;
    close(pfd[1]);

    int exec_err = 0;
    ssize_t n;
    do {
        n = read(pfd[0], &exec_err, sizeof exec_err);
    } while (n < 0 && errno == EINTR);
    close(pfd[0]);
    r.exec_ns = now_ns();
    if (n == (ssize_t)sizeof exec_err) {
        r.exec_errno = exec_err;
        char msg[200];
        snprintf(msg, sizeof msg, "exec failed: %s", strerror(exec_err));
        add_warning(msg);
    }

    struct lp_sampler sampler;
    memset(&sampler, 0, sizeof sampler);
    int sampler_ok = 0;
    if (o.tier_p) {
        int rc = lp_sampler_open(&sampler, pid, p_path);
        if (rc != 0) {
            fprintf(stderr, "lp-run: cannot create %s: %s\n", p_path, strerror(-rc));
            kill(pid, SIGKILL);
            waitpid(pid, NULL, 0);
            return 1;
        }
        sampler_ok = 1;
    }

    struct lp_watchdog wd;
    memset(&wd, 0, sizeof wd);
    if (o.tier_f) {
        int rc = lp_watchdog_init(&wd, f_path, (uint64_t)o.watchdog_ms * 1000000ull, r.exec_ns);
        if (rc != 0) {
            char msg[200];
            snprintf(msg, sizeof msg, "watchdog could not map trace: %s", strerror(-rc));
            add_warning(msg);
        } else {
            r.tierf_mapped = 1;
        }
    }

    const uint64_t interval_ns = (uint64_t)o.interval_ms * 1000000ull;
    const uint64_t max_ns = (uint64_t)o.max_ms * 1000000ull;
    uint64_t next = r.exec_ns;
    int status = 0;
    int reaped = 0;

    for (;;) {
        pid_t w = waitpid(pid, &status, WNOHANG);
        if (w == pid) {
            reaped = 1;
            break;
        }
        if (w < 0 && errno != EINTR) {
            perror("lp-run: waitpid");
            break;
        }

        uint64_t t = now_ns();
        if (o.tier_p)
            lp_sampler_tick(&sampler, t);

        if (o.tier_f && r.tierf_mapped && lp_watchdog_expired(&wd, t)) {
            r.killed_by = "watchdog";
            r.kill_ns = now_ns();
            kill(pid, SIGKILL);
            break;
        }
        if (t - r.start_ns >= max_ns) {
            r.killed_by = "max_time";
            r.kill_ns = now_ns();
            kill(pid, SIGKILL);
            break;
        }

        /* absolute-time pacing: no drift; skip ticks we already missed */
        next += interval_ns;
        uint64_t after = now_ns();
        while (next <= after)
            next += interval_ns;
        struct timespec ts = {.tv_sec = (time_t)(next / 1000000000ull),
                              .tv_nsec = (long)(next % 1000000000ull)};
        int rc;
        do {
            rc = clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &ts, NULL);
        } while (rc == EINTR);
    }

    if (!reaped) {
        while (waitpid(pid, &status, 0) < 0) {
            if (errno != EINTR) {
                perror("lp-run: waitpid");
                break;
            }
        }
    }
    r.end_ns = now_ns();
    decode_status(status, &r);
    measure_self_cpu(&r);

    if (o.tier_f && r.tierf_mapped) {
        r.progress_counter = lp_watchdog_counter(&wd);
        lp_watchdog_expired(&wd, r.end_ns); /* refresh last change */
        r.last_progress_observed_ns = wd.last_change_ns;
        r.overflow = lp_watchdog_overflow(&wd);
        r.dropped = lp_watchdog_dropped(&wd);
        r.threads_seen = lp_watchdog_threads_seen(&wd);
        if (r.threads_seen == 0)
            add_warning("tier F trace is empty: shim did not log (LD_PRELOAD not applied?)");
        lp_watchdog_close(&wd);
    }

    int write_err = 0;
    if (sampler_ok) {
        if (sampler.ticks > 0 && sampler.syscall_ok == 0 && sampler.syscall_unreadable > 0) {
            char msg[200];
            snprintf(msg, sizeof msg, "/proc/<tid>/syscall unreadable (last errno: %s); syscall_nr=-2",
                     strerror(sampler.last_syscall_errno));
            add_warning(msg);
        }
        int rc = lp_sampler_close(&sampler);
        if (rc != 0) {
            fprintf(stderr, "lp-run: error writing %s: %s\n", p_path, strerror(-rc));
            write_err = 1;
        }
    }

    int rc = write_meta(m_path, &o, &r, &sampler, o.tier_p ? p_path : NULL, o.tier_f ? f_path : NULL);
    if (rc != 0) {
        fprintf(stderr, "lp-run: cannot write %s: %s\n", m_path, strerror(-rc));
        return 1;
    }

    fprintf(stderr, "lp-run: run=%s family=%s tier=%s exit=%s duration_ms=%.1f samples=%llu\n", o.run_id,
            o.family, o.tier, r.exit_reason, (double)(r.end_ns - r.start_ns) / 1e6,
            (unsigned long long)sampler.rows);
    return write_err ? 1 : 0;
}
