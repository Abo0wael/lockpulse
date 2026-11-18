/*
 * watchdog.c - progress watchdog. See watchdog.h.
 */
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "watchdog.h"

#include <stdatomic.h>

int lp_watchdog_init(struct lp_watchdog *w, const char *trace_path, uint64_t timeout_ns, uint64_t now_ns)
{
    w->timeout_ns = timeout_ns;
    w->last_value = 0;
    w->last_change_ns = now_ns;
    return lp_tb_map(trace_path, 0, &w->tb);
}

uint64_t lp_watchdog_counter(struct lp_watchdog *w)
{
    if (w->tb.hdr == NULL)
        return 0;
    return atomic_load_explicit(&w->tb.hdr->progress_counter, memory_order_acquire);
}

int lp_watchdog_expired(struct lp_watchdog *w, uint64_t now_ns)
{
    if (w->tb.hdr == NULL)
        return 0;
    uint64_t v = lp_watchdog_counter(w);
    if (v != w->last_value) {
        w->last_value = v;
        w->last_change_ns = now_ns;
        return 0;
    }
    return now_ns - w->last_change_ns >= w->timeout_ns;
}

uint32_t lp_watchdog_overflow(struct lp_watchdog *w)
{
    if (w->tb.hdr == NULL)
        return 0;
    return atomic_load_explicit(&w->tb.hdr->overflow, memory_order_acquire);
}

uint64_t lp_watchdog_dropped(struct lp_watchdog *w)
{
    if (w->tb.hdr == NULL)
        return 0;
    return atomic_load_explicit(&w->tb.hdr->dropped_records, memory_order_acquire);
}

uint32_t lp_watchdog_threads_seen(struct lp_watchdog *w)
{
    if (w->tb.hdr == NULL)
        return 0;
    return atomic_load_explicit(&w->tb.hdr->next_slot, memory_order_acquire);
}

void lp_watchdog_close(struct lp_watchdog *w)
{
    lp_tb_unmap(&w->tb);
}
