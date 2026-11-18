/*
 * shim.c - LD_PRELOAD interposer for pthread mutex calls (Tier F, phase 1).
 *
 * Tier F exists ONLY for ground-truth labels and as an upper-bound baseline.
 * It is never a model input.
 *
 * Activation: the constructor reads LP_TRACE_PATH and maps that file
 * (created beforehand by lp-run). If LP_TRACE_PATH is unset or the file is
 * invalid, every call is passed through and nothing is logged.
 *
 * Hot-path rules: no malloc, no stdio, no locks. Recursion into the shim is
 * prevented with a thread-local flag. All thread-locals use the initial-exec
 * TLS model so that accessing them never calls __tls_get_addr (which may
 * allocate); this is valid because the library is loaded via LD_PRELOAD at
 * startup, never via dlopen.
 *
 * Real functions are resolved lazily with dlsym(RTLD_NEXT, ...) because a
 * mutex call can arrive before our constructor runs (e.g. from another
 * library's constructor); the constructor also pre-resolves them.
 *
 * PHASE 2 NOTE (not implemented): pthread_cond_* have versioned symbols in
 * glibc (the old GLIBC_2.2.5 ABI and the current GLIBC_2.3.2 one). Resolve
 * them with dlvsym(RTLD_NEXT, "pthread_cond_wait", "GLIBC_2.3.2") (same for
 * signal/broadcast/timedwait/init/destroy) - plain dlsym may return the old
 * compat version and corrupt condvars. sem_* and pthread_barrier_* follow.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "tracebuf.h"

#include <dlfcn.h>
#include <errno.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdlib.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

#define LP_API __attribute__((visibility("default")))
#define LP_TLS __attribute__((tls_model("initial-exec")))

typedef int (*lp_mutex_fn)(pthread_mutex_t *);

static _Atomic(lp_mutex_fn) g_real_lock;
static _Atomic(lp_mutex_fn) g_real_trylock;
static _Atomic(lp_mutex_fn) g_real_unlock;
static _Atomic(struct lp_header *) g_hdr;

static _Thread_local int t_in_shim LP_TLS;
static _Thread_local int t_slot LP_TLS = -1; /* -1 unclaimed, -2 no slot available */
static _Thread_local uint32_t t_tid LP_TLS;

/* glibc's exported internal aliases; used only if a call re-enters the shim
 * while dlsym is still resolving the real symbol. Weak: NULL if absent. */
extern int __pthread_mutex_lock(pthread_mutex_t *m) __attribute__((weak));
extern int __pthread_mutex_trylock(pthread_mutex_t *m) __attribute__((weak));
extern int __pthread_mutex_unlock(pthread_mutex_t *m) __attribute__((weak));

static inline uint64_t lp_now_ns(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;
}

/* Resolve (and cache) the next definition of `name`. Must be called with
 * t_in_shim set, so that anything dlsym does re-enters via the fallback. */
static lp_mutex_fn lp_resolve(_Atomic(lp_mutex_fn) *cache, const char *name, lp_mutex_fn fallback)
{
    lp_mutex_fn fn = atomic_load_explicit(cache, memory_order_acquire);
    if (fn != NULL)
        return fn;
    fn = (lp_mutex_fn)dlsym(RTLD_NEXT, name);
    if (fn != NULL) {
        atomic_store_explicit(cache, fn, memory_order_release);
        return fn;
    }
    return fallback;
}

/* Used when re-entered: never calls dlsym again. */
static lp_mutex_fn lp_cached_or(_Atomic(lp_mutex_fn) *cache, lp_mutex_fn fallback)
{
    lp_mutex_fn fn = atomic_load_explicit(cache, memory_order_acquire);
    return fn != NULL ? fn : fallback;
}

static void lp_log(struct lp_header *h, uint16_t event, const void *obj, uint64_t wait_ns, uint64_t ts)
{
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
        .event = event, .site = 0,
    };
    lp_tb_append(h, (uint32_t)t_slot, &r);
}

static inline void lp_progress(struct lp_header *h)
{
    atomic_fetch_add_explicit(&h->progress_counter, 1, memory_order_relaxed);
}

LP_API int pthread_mutex_lock(pthread_mutex_t *m)
{
    if (t_in_shim) {
        lp_mutex_fn fn = lp_cached_or(&g_real_lock, __pthread_mutex_lock);
        return fn != NULL ? fn(m) : EAGAIN;
    }
    t_in_shim = 1;
    lp_mutex_fn real = lp_resolve(&g_real_lock, "pthread_mutex_lock", __pthread_mutex_lock);
    if (real == NULL) {
        t_in_shim = 0;
        return EAGAIN;
    }
    struct lp_header *h = atomic_load_explicit(&g_hdr, memory_order_acquire);
    if (h == NULL) {
        t_in_shim = 0;
        return real(m);
    }

    uint64_t t0 = lp_now_ns();
    lp_log(h, LP_EV_MUTEX_REQ, m, 0, t0);
    int rc = real(m);
    uint64_t t1 = lp_now_ns();
    if (rc == 0) {
        lp_log(h, LP_EV_MUTEX_ACQ, m, t1 - t0, t1);
        lp_progress(h);
    } else {
        lp_log(h, LP_EV_ERROR, m, (uint64_t)(unsigned int)rc, t1);
    }
    t_in_shim = 0;
    return rc;
}

LP_API int pthread_mutex_trylock(pthread_mutex_t *m)
{
    if (t_in_shim) {
        lp_mutex_fn fn = lp_cached_or(&g_real_trylock, __pthread_mutex_trylock);
        return fn != NULL ? fn(m) : EBUSY;
    }
    t_in_shim = 1;
    lp_mutex_fn real = lp_resolve(&g_real_trylock, "pthread_mutex_trylock", __pthread_mutex_trylock);
    if (real == NULL) {
        t_in_shim = 0;
        return EBUSY;
    }
    struct lp_header *h = atomic_load_explicit(&g_hdr, memory_order_acquire);
    if (h == NULL) {
        t_in_shim = 0;
        return real(m);
    }

    int rc = real(m);
    uint64_t t1 = lp_now_ns();
    if (rc == 0) {
        lp_log(h, LP_EV_MUTEX_ACQ, m, 0, t1);
        lp_progress(h);
    } else if (rc == EBUSY) {
        lp_log(h, LP_EV_MUTEX_TRYLOCK_FAIL, m, 0, t1);
    } else {
        lp_log(h, LP_EV_ERROR, m, (uint64_t)(unsigned int)rc, t1);
    }
    t_in_shim = 0;
    return rc;
}

LP_API int pthread_mutex_unlock(pthread_mutex_t *m)
{
    if (t_in_shim) {
        lp_mutex_fn fn = lp_cached_or(&g_real_unlock, __pthread_mutex_unlock);
        return fn != NULL ? fn(m) : EPERM;
    }
    t_in_shim = 1;
    lp_mutex_fn real = lp_resolve(&g_real_unlock, "pthread_mutex_unlock", __pthread_mutex_unlock);
    if (real == NULL) {
        t_in_shim = 0;
        return EPERM;
    }
    struct lp_header *h = atomic_load_explicit(&g_hdr, memory_order_acquire);
    if (h == NULL) {
        t_in_shim = 0;
        return real(m);
    }

    /* Timestamp before releasing, so REL always precedes the next owner's ACQ. */
    uint64_t t0 = lp_now_ns();
    int rc = real(m);
    if (rc == 0) {
        lp_log(h, LP_EV_MUTEX_REL, m, 0, t0);
        lp_progress(h);
    } else {
        lp_log(h, LP_EV_ERROR, m, (uint64_t)(unsigned int)rc, lp_now_ns());
    }
    t_in_shim = 0;
    return rc;
}

static void lp_shim_init(void) __attribute__((constructor));
static void lp_shim_init(void)
{
    t_in_shim = 1;
    lp_resolve(&g_real_lock, "pthread_mutex_lock", NULL);
    lp_resolve(&g_real_trylock, "pthread_mutex_trylock", NULL);
    lp_resolve(&g_real_unlock, "pthread_mutex_unlock", NULL);

    const char *path = getenv("LP_TRACE_PATH");
    if (path != NULL && path[0] != '\0') {
        struct lp_tracebuf tb;
        if (lp_tb_map(path, 1, &tb) == 0)
            atomic_store_explicit(&g_hdr, tb.hdr, memory_order_release);
        /* On failure we stay in pass-through mode; lp-run notices the empty trace. */
    }
    t_in_shim = 0;
    /* Never unmapped: other threads may log until the process dies. */
}
