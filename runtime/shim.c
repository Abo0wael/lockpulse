/*
 * shim.c - LD_PRELOAD interposer for pthread synchronization (Tier F, schema v2).
 *
 * Tier F exists ONLY for ground-truth labels and as an upper-bound baseline.
 * It is never a model input.
 *
 * Interposed: pthread_mutex_{lock,trylock,unlock}, pthread_cond_{wait,
 * timedwait,signal,broadcast}, sem_{wait,timedwait,trywait,post},
 * pthread_barrier_wait.
 *
 * Activation: the constructor reads LP_TRACE_PATH and maps that file
 * (created beforehand by lp-run). If LP_TRACE_PATH is unset or the file is
 * invalid, every call is passed through and nothing is logged.
 *
 * Hot-path rules: no malloc, no stdio, no locks. Recursion into the shim is
 * prevented with a thread-local flag. All thread-locals use the initial-exec
 * TLS model so that accessing them never calls __tls_get_addr (which may
 * allocate); this is valid because the library is loaded via LD_PRELOAD at
 * startup, never via dlopen. errno is preserved across logging.
 *
 * Symbol versions: glibc exports several of these functions in more than one
 * version. pthread_cond_* exist as GLIBC_2.2.5 (old, incompatible condvar
 * ABI) and GLIBC_2.3.2 (default); plain dlsym may return the OLD one, which
 * would corrupt every condvar. Since glibc 2.34 the former libpthread symbols
 * (sem_*, pthread_barrier_wait) are GLIBC_2.34 (default) with a GLIBC_2.2.5
 * compat alias to the same code. So each function is resolved with
 * dlvsym(RTLD_NEXT, name, version) over its candidate list below, falling back
 * to dlsym. The outcome is recorded in header.resolve_how[] (lp-dump --info)
 * and CI prints the available versions with objdump -T.
 *
 * Event mapping (see runtime/tracebuf.h):
 *   mutex_lock      MUTEX_REQ, then MUTEX_ACQ (wait_ns = blocked time) | ERROR
 *   mutex_trylock   MUTEX_ACQ | MUTEX_TRYLOCK_FAIL | ERROR
 *   mutex_unlock    MUTEX_REL | ERROR
 *   cond_[timed]wait COND_WAIT_ENTER + implicit MUTEX_REL (site=LP_SITE_IMPLICIT);
 *                   on return the mutex is re-acquired inside glibc: implicit
 *                   MUTEX_ACQ, then COND_WAIT_EXIT (rc 0) or ERROR (e.g. ETIMEDOUT)
 *   cond_signal     COND_SIGNAL | ERROR      cond_broadcast  COND_BROADCAST | ERROR
 *   sem_[timed]wait SEM_WAIT_ENTER, then SEM_WAIT_EXIT | ERROR(errno)
 *   sem_trywait     SEM_WAIT_EXIT | SEM_TRYWAIT_FAIL (EAGAIN) | ERROR(errno)
 *   sem_post        SEM_POST | ERROR(errno)
 *   barrier_wait    BARRIER_ENTER, then BARRIER_EXIT | ERROR
 * Release-type events (REL, SIGNAL, BROADCAST, POST) are timestamped before
 * the real call so they always precede the wake-up they cause.
 * progress_counter is incremented for every event with lp_is_progress().
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "tracebuf.h"

#include <dlfcn.h>
#include <errno.h>
#include <pthread.h>
#include <semaphore.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdlib.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

#define LP_API __attribute__((visibility("default")))
#define LP_TLS __attribute__((tls_model("initial-exec")))

typedef int (*lp_mutex_fn)(pthread_mutex_t *);
typedef int (*lp_cwait_fn)(pthread_cond_t *, pthread_mutex_t *);
typedef int (*lp_ctwait_fn)(pthread_cond_t *, pthread_mutex_t *, const struct timespec *);
typedef int (*lp_cond_fn)(pthread_cond_t *);
typedef int (*lp_sem_fn)(sem_t *);
typedef int (*lp_stwait_fn)(sem_t *, const struct timespec *);
typedef int (*lp_barrier_fn)(pthread_barrier_t *);

struct lp_sym {
    const char *name;
    const char *ver[2]; /* dlvsym candidates in order of preference; NULL = none */
};

static const struct lp_sym k_syms[LP_FN_COUNT] = {
    [LP_FN_MUTEX_LOCK] = {"pthread_mutex_lock", {NULL, NULL}},
    [LP_FN_MUTEX_TRYLOCK] = {"pthread_mutex_trylock", {NULL, NULL}},
    [LP_FN_MUTEX_UNLOCK] = {"pthread_mutex_unlock", {NULL, NULL}},
    [LP_FN_COND_WAIT] = {"pthread_cond_wait", {"GLIBC_2.3.2", NULL}},
    [LP_FN_COND_TIMEDWAIT] = {"pthread_cond_timedwait", {"GLIBC_2.3.2", NULL}},
    [LP_FN_COND_SIGNAL] = {"pthread_cond_signal", {"GLIBC_2.3.2", NULL}},
    [LP_FN_COND_BROADCAST] = {"pthread_cond_broadcast", {"GLIBC_2.3.2", NULL}},
    [LP_FN_SEM_WAIT] = {"sem_wait", {"GLIBC_2.34", "GLIBC_2.2.5"}},
    [LP_FN_SEM_TIMEDWAIT] = {"sem_timedwait", {"GLIBC_2.34", "GLIBC_2.2.5"}},
    [LP_FN_SEM_TRYWAIT] = {"sem_trywait", {"GLIBC_2.34", "GLIBC_2.2.5"}},
    [LP_FN_SEM_POST] = {"sem_post", {"GLIBC_2.34", "GLIBC_2.2.5"}},
    [LP_FN_BARRIER_WAIT] = {"pthread_barrier_wait", {"GLIBC_2.34", "GLIBC_2.2.5"}},
};

static _Atomic(void *) g_real[LP_FN_COUNT];
static _Atomic(uint8_t) g_how[LP_FN_COUNT];
static _Atomic(struct lp_header *) g_hdr;

static _Thread_local int t_in_shim LP_TLS;
static _Thread_local int t_slot LP_TLS = -1; /* -1 unclaimed, -2 no slot available */
static _Thread_local uint32_t t_tid LP_TLS;

/* glibc's exported internal mutex aliases; used only if a mutex call
 * re-enters the shim before the real symbol is cached. Weak: NULL if absent. */
extern int __pthread_mutex_lock(pthread_mutex_t *m) __attribute__((weak));
extern int __pthread_mutex_trylock(pthread_mutex_t *m) __attribute__((weak));
extern int __pthread_mutex_unlock(pthread_mutex_t *m) __attribute__((weak));

static inline uint64_t lp_now_ns(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;
}

/* Resolve (and cache) the next definition of function f. Call with t_in_shim
 * set, so that anything dlvsym/dlsym does re-enters via the cached path. */
static void *lp_resolve(int f)
{
    void *p = atomic_load_explicit(&g_real[f], memory_order_acquire);
    if (p != NULL)
        return p;
    uint8_t how = LP_RESOLVE_NONE;
    for (int i = 0; i < 2 && p == NULL; i++) {
        if (k_syms[f].ver[i] == NULL)
            break;
        p = dlvsym(RTLD_NEXT, k_syms[f].name, k_syms[f].ver[i]);
        if (p != NULL)
            how = (uint8_t)(LP_RESOLVE_DLVSYM0 + (unsigned)i);
    }
    if (p == NULL) {
        p = dlsym(RTLD_NEXT, k_syms[f].name);
        if (p != NULL)
            how = LP_RESOLVE_DLSYM;
    }
    if (p != NULL) {
        atomic_store_explicit(&g_how[f], how, memory_order_relaxed);
        atomic_store_explicit(&g_real[f], p, memory_order_release);
    }
    return p;
}

static inline void *lp_cached(int f)
{
    return atomic_load_explicit(&g_real[f], memory_order_acquire);
}

static void lp_log(struct lp_header *h, uint16_t event, const void *obj, uint64_t wait_ns, uint64_t ts,
                   uint16_t site)
{
    if (lp_is_progress(event))
        atomic_fetch_add_explicit(&h->progress_counter, 1, memory_order_relaxed);

    if (t_slot < 0) {
        if (t_slot == -2)
            return;
        uint32_t s = atomic_fetch_add_explicit(&h->next_slot, 1, memory_order_relaxed);
        if (s >= h->max_threads) {
            atomic_fetch_or_explicit(&h->overflow, LP_OVF_SLOTS, memory_order_relaxed);
            t_slot = -2;
            return;
        }
        t_slot = (int)s;
        t_tid = (uint32_t)syscall(SYS_gettid);
        lp_tb_region(h, s)->tid = t_tid;
        struct lp_record first = {
            .ts_ns = ts, .wait_ns = 0, .obj_addr = 0, .tid = t_tid,
            .event = LP_EV_THREAD_FIRST_SEEN, .site = 0,
        };
        lp_tb_append(h, s, &first);
    }
    struct lp_record r = {
        .ts_ns = ts, .wait_ns = wait_ns, .obj_addr = (uint64_t)(uintptr_t)obj, .tid = t_tid,
        .event = event, .site = site,
    };
    lp_tb_append(h, (uint32_t)t_slot, &r);
}

static inline struct lp_header *lp_hdr(void)
{
    return atomic_load_explicit(&g_hdr, memory_order_acquire);
}

/* ------------------------------------------------------------------ mutex */

LP_API int pthread_mutex_lock(pthread_mutex_t *m)
{
    if (t_in_shim) {
        lp_mutex_fn fn = (lp_mutex_fn)lp_cached(LP_FN_MUTEX_LOCK);
        if (fn == NULL)
            fn = __pthread_mutex_lock;
        return fn != NULL ? fn(m) : EAGAIN;
    }
    t_in_shim = 1;
    lp_mutex_fn real = (lp_mutex_fn)lp_resolve(LP_FN_MUTEX_LOCK);
    if (real == NULL)
        real = __pthread_mutex_lock;
    if (real == NULL) {
        t_in_shim = 0;
        return EAGAIN;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(m);
    }

    uint64_t t0 = lp_now_ns();
    lp_log(h, LP_EV_MUTEX_REQ, m, 0, t0, 0);
    int rc = real(m);
    uint64_t t1 = lp_now_ns();
    if (rc == 0)
        lp_log(h, LP_EV_MUTEX_ACQ, m, t1 - t0, t1, 0);
    else
        lp_log(h, LP_EV_ERROR, m, (uint64_t)(unsigned int)rc, t1, 0);
    t_in_shim = 0;
    return rc;
}

LP_API int pthread_mutex_trylock(pthread_mutex_t *m)
{
    if (t_in_shim) {
        lp_mutex_fn fn = (lp_mutex_fn)lp_cached(LP_FN_MUTEX_TRYLOCK);
        if (fn == NULL)
            fn = __pthread_mutex_trylock;
        return fn != NULL ? fn(m) : EBUSY;
    }
    t_in_shim = 1;
    lp_mutex_fn real = (lp_mutex_fn)lp_resolve(LP_FN_MUTEX_TRYLOCK);
    if (real == NULL)
        real = __pthread_mutex_trylock;
    if (real == NULL) {
        t_in_shim = 0;
        return EBUSY;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(m);
    }

    int rc = real(m);
    uint64_t t1 = lp_now_ns();
    if (rc == 0)
        lp_log(h, LP_EV_MUTEX_ACQ, m, 0, t1, 0);
    else if (rc == EBUSY)
        lp_log(h, LP_EV_MUTEX_TRYLOCK_FAIL, m, 0, t1, 0);
    else
        lp_log(h, LP_EV_ERROR, m, (uint64_t)(unsigned int)rc, t1, 0);
    t_in_shim = 0;
    return rc;
}

LP_API int pthread_mutex_unlock(pthread_mutex_t *m)
{
    if (t_in_shim) {
        lp_mutex_fn fn = (lp_mutex_fn)lp_cached(LP_FN_MUTEX_UNLOCK);
        if (fn == NULL)
            fn = __pthread_mutex_unlock;
        return fn != NULL ? fn(m) : EPERM;
    }
    t_in_shim = 1;
    lp_mutex_fn real = (lp_mutex_fn)lp_resolve(LP_FN_MUTEX_UNLOCK);
    if (real == NULL)
        real = __pthread_mutex_unlock;
    if (real == NULL) {
        t_in_shim = 0;
        return EPERM;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(m);
    }

    uint64_t t0 = lp_now_ns(); /* before releasing: REL precedes the next owner's ACQ */
    int rc = real(m);
    if (rc == 0)
        lp_log(h, LP_EV_MUTEX_REL, m, 0, t0, 0);
    else
        lp_log(h, LP_EV_ERROR, m, (uint64_t)(unsigned int)rc, lp_now_ns(), 0);
    t_in_shim = 0;
    return rc;
}

/* ------------------------------------------------------------------- cond */

/* Shared tail of cond_wait / cond_timedwait. glibc re-acquires the mutex
 * before returning 0, ETIMEDOUT or EOWNERDEAD; other errors (EINVAL, EPERM)
 * are reported before the mutex was released. */
static void lp_cond_wait_done(struct lp_header *h, pthread_cond_t *c, pthread_mutex_t *m, int rc,
                              uint64_t t0)
{
    uint64_t t1 = lp_now_ns();
    if (rc == 0) {
        lp_log(h, LP_EV_MUTEX_ACQ, m, 0, t1, LP_SITE_IMPLICIT);
        lp_log(h, LP_EV_COND_WAIT_EXIT, c, t1 - t0, t1, 0);
    } else if (rc == ETIMEDOUT || rc == EOWNERDEAD) {
        lp_log(h, LP_EV_MUTEX_ACQ, m, 0, t1, LP_SITE_IMPLICIT);
        lp_log(h, LP_EV_ERROR, c, (uint64_t)(unsigned int)rc, t1, 0);
    } else {
        /* the implicit REL logged at entry did not happen: undo it */
        lp_log(h, LP_EV_MUTEX_ACQ, m, 0, t1, LP_SITE_IMPLICIT);
        lp_log(h, LP_EV_ERROR, c, (uint64_t)(unsigned int)rc, t1, 0);
    }
}

LP_API int pthread_cond_wait(pthread_cond_t *restrict c, pthread_mutex_t *restrict m)
{
    if (t_in_shim) {
        lp_cwait_fn fn = (lp_cwait_fn)lp_cached(LP_FN_COND_WAIT);
        return fn != NULL ? fn(c, m) : EINVAL;
    }
    t_in_shim = 1;
    lp_cwait_fn real = (lp_cwait_fn)lp_resolve(LP_FN_COND_WAIT);
    if (real == NULL) {
        t_in_shim = 0;
        return EINVAL;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(c, m);
    }

    uint64_t t0 = lp_now_ns();
    lp_log(h, LP_EV_COND_WAIT_ENTER, c, 0, t0, 0);
    lp_log(h, LP_EV_MUTEX_REL, m, 0, t0, LP_SITE_IMPLICIT);
    int rc = real(c, m);
    lp_cond_wait_done(h, c, m, rc, t0);
    t_in_shim = 0;
    return rc;
}

LP_API int pthread_cond_timedwait(pthread_cond_t *restrict c, pthread_mutex_t *restrict m,
                                  const struct timespec *restrict abstime)
{
    if (t_in_shim) {
        lp_ctwait_fn fn = (lp_ctwait_fn)lp_cached(LP_FN_COND_TIMEDWAIT);
        return fn != NULL ? fn(c, m, abstime) : EINVAL;
    }
    t_in_shim = 1;
    lp_ctwait_fn real = (lp_ctwait_fn)lp_resolve(LP_FN_COND_TIMEDWAIT);
    if (real == NULL) {
        t_in_shim = 0;
        return EINVAL;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(c, m, abstime);
    }

    uint64_t t0 = lp_now_ns();
    lp_log(h, LP_EV_COND_WAIT_ENTER, c, 0, t0, 0);
    lp_log(h, LP_EV_MUTEX_REL, m, 0, t0, LP_SITE_IMPLICIT);
    int rc = real(c, m, abstime);
    lp_cond_wait_done(h, c, m, rc, t0);
    t_in_shim = 0;
    return rc;
}

static int lp_cond_notify(int f, uint16_t event, pthread_cond_t *c)
{
    if (t_in_shim) {
        lp_cond_fn fn = (lp_cond_fn)lp_cached(f);
        return fn != NULL ? fn(c) : EINVAL;
    }
    t_in_shim = 1;
    lp_cond_fn real = (lp_cond_fn)lp_resolve(f);
    if (real == NULL) {
        t_in_shim = 0;
        return EINVAL;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(c);
    }

    uint64_t t0 = lp_now_ns();
    int rc = real(c);
    if (rc == 0)
        lp_log(h, event, c, 0, t0, 0);
    else
        lp_log(h, LP_EV_ERROR, c, (uint64_t)(unsigned int)rc, lp_now_ns(), 0);
    t_in_shim = 0;
    return rc;
}

LP_API int pthread_cond_signal(pthread_cond_t *c)
{
    return lp_cond_notify(LP_FN_COND_SIGNAL, LP_EV_COND_SIGNAL, c);
}

LP_API int pthread_cond_broadcast(pthread_cond_t *c)
{
    return lp_cond_notify(LP_FN_COND_BROADCAST, LP_EV_COND_BROADCAST, c);
}

/* -------------------------------------------------------------- semaphore */
/* sem_* return -1 and set errno on failure. */

LP_API int sem_wait(sem_t *s)
{
    if (t_in_shim) {
        lp_sem_fn fn = (lp_sem_fn)lp_cached(LP_FN_SEM_WAIT);
        if (fn != NULL)
            return fn(s);
        errno = EINVAL;
        return -1;
    }
    t_in_shim = 1;
    lp_sem_fn real = (lp_sem_fn)lp_resolve(LP_FN_SEM_WAIT);
    if (real == NULL) {
        t_in_shim = 0;
        errno = EINVAL;
        return -1;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(s);
    }

    uint64_t t0 = lp_now_ns();
    lp_log(h, LP_EV_SEM_WAIT_ENTER, s, 0, t0, 0);
    int rc = real(s);
    int e = errno;
    uint64_t t1 = lp_now_ns();
    if (rc == 0)
        lp_log(h, LP_EV_SEM_WAIT_EXIT, s, t1 - t0, t1, 0);
    else
        lp_log(h, LP_EV_ERROR, s, (uint64_t)(unsigned int)e, t1, 0);
    t_in_shim = 0;
    errno = e;
    return rc;
}

LP_API int sem_timedwait(sem_t *restrict s, const struct timespec *restrict abstime)
{
    if (t_in_shim) {
        lp_stwait_fn fn = (lp_stwait_fn)lp_cached(LP_FN_SEM_TIMEDWAIT);
        if (fn != NULL)
            return fn(s, abstime);
        errno = EINVAL;
        return -1;
    }
    t_in_shim = 1;
    lp_stwait_fn real = (lp_stwait_fn)lp_resolve(LP_FN_SEM_TIMEDWAIT);
    if (real == NULL) {
        t_in_shim = 0;
        errno = EINVAL;
        return -1;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(s, abstime);
    }

    uint64_t t0 = lp_now_ns();
    lp_log(h, LP_EV_SEM_WAIT_ENTER, s, 0, t0, 0);
    int rc = real(s, abstime);
    int e = errno;
    uint64_t t1 = lp_now_ns();
    if (rc == 0)
        lp_log(h, LP_EV_SEM_WAIT_EXIT, s, t1 - t0, t1, 0);
    else
        lp_log(h, LP_EV_ERROR, s, (uint64_t)(unsigned int)e, t1, 0);
    t_in_shim = 0;
    errno = e;
    return rc;
}

LP_API int sem_trywait(sem_t *s)
{
    if (t_in_shim) {
        lp_sem_fn fn = (lp_sem_fn)lp_cached(LP_FN_SEM_TRYWAIT);
        if (fn != NULL)
            return fn(s);
        errno = EAGAIN;
        return -1;
    }
    t_in_shim = 1;
    lp_sem_fn real = (lp_sem_fn)lp_resolve(LP_FN_SEM_TRYWAIT);
    if (real == NULL) {
        t_in_shim = 0;
        errno = EAGAIN;
        return -1;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(s);
    }

    int rc = real(s);
    int e = errno;
    uint64_t t1 = lp_now_ns();
    if (rc == 0)
        lp_log(h, LP_EV_SEM_WAIT_EXIT, s, 0, t1, 0);
    else if (e == EAGAIN)
        lp_log(h, LP_EV_SEM_TRYWAIT_FAIL, s, 0, t1, 0);
    else
        lp_log(h, LP_EV_ERROR, s, (uint64_t)(unsigned int)e, t1, 0);
    t_in_shim = 0;
    errno = e;
    return rc;
}

LP_API int sem_post(sem_t *s)
{
    if (t_in_shim) {
        lp_sem_fn fn = (lp_sem_fn)lp_cached(LP_FN_SEM_POST);
        if (fn != NULL)
            return fn(s);
        errno = EINVAL;
        return -1;
    }
    t_in_shim = 1;
    lp_sem_fn real = (lp_sem_fn)lp_resolve(LP_FN_SEM_POST);
    if (real == NULL) {
        t_in_shim = 0;
        errno = EINVAL;
        return -1;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(s);
    }

    uint64_t t0 = lp_now_ns(); /* before posting: POST precedes the waiter's EXIT */
    int rc = real(s);
    int e = errno;
    if (rc == 0)
        lp_log(h, LP_EV_SEM_POST, s, 0, t0, 0);
    else
        lp_log(h, LP_EV_ERROR, s, (uint64_t)(unsigned int)e, lp_now_ns(), 0);
    t_in_shim = 0;
    errno = e;
    return rc;
}

/* ---------------------------------------------------------------- barrier */

LP_API int pthread_barrier_wait(pthread_barrier_t *b)
{
    if (t_in_shim) {
        lp_barrier_fn fn = (lp_barrier_fn)lp_cached(LP_FN_BARRIER_WAIT);
        return fn != NULL ? fn(b) : EINVAL;
    }
    t_in_shim = 1;
    lp_barrier_fn real = (lp_barrier_fn)lp_resolve(LP_FN_BARRIER_WAIT);
    if (real == NULL) {
        t_in_shim = 0;
        return EINVAL;
    }
    struct lp_header *h = lp_hdr();
    if (h == NULL) {
        t_in_shim = 0;
        return real(b);
    }

    uint64_t t0 = lp_now_ns();
    lp_log(h, LP_EV_BARRIER_ENTER, b, 0, t0, 0);
    int rc = real(b);
    uint64_t t1 = lp_now_ns();
    if (rc == 0 || rc == PTHREAD_BARRIER_SERIAL_THREAD)
        lp_log(h, LP_EV_BARRIER_EXIT, b, t1 - t0, t1, 0);
    else
        lp_log(h, LP_EV_ERROR, b, (uint64_t)(unsigned int)rc, t1, 0);
    t_in_shim = 0;
    return rc;
}

/* ------------------------------------------------------------ constructor */

static void lp_shim_init(void) __attribute__((constructor));
static void lp_shim_init(void)
{
    int saved = errno;
    t_in_shim = 1;
    for (int f = 0; f < LP_FN_COUNT; f++)
        lp_resolve(f);

    const char *path = getenv("LP_TRACE_PATH");
    if (path != NULL && path[0] != '\0') {
        struct lp_tracebuf tb;
        if (lp_tb_map(path, 1, &tb) == 0) {
            for (int f = 0; f < LP_FN_COUNT; f++)
                tb.hdr->resolve_how[f] = atomic_load_explicit(&g_how[f], memory_order_relaxed);
            atomic_store_explicit(&g_hdr, tb.hdr, memory_order_release);
        }
        /* On failure we stay in pass-through mode; lp-run notices the empty trace. */
    }
    t_in_shim = 0;
    errno = saved;
    /* Never unmapped: other threads may log until the process dies. */
}
