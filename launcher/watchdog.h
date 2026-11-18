/*
 * watchdog.h - progress watchdog over the Tier F trace header.
 *
 * Maps the trace file read-only and watches progress_counter (incremented by
 * the shim on every MUTEX_ACQ / MUTEX_REL). If it does not change for
 * timeout_ns, the run is declared stuck. The max-time cap is enforced
 * separately by the launcher for every tier.
 */
#ifndef LOCKPULSE_WATCHDOG_H
#define LOCKPULSE_WATCHDOG_H

#include <stdint.h>

#include "tracebuf.h"

struct lp_watchdog {
    struct lp_tracebuf tb;
    uint64_t timeout_ns;
    uint64_t last_value;
    uint64_t last_change_ns; /* monotonic ns when last_value was first observed */
};

/* Returns 0 or -errno. */
int lp_watchdog_init(struct lp_watchdog *w, const char *trace_path, uint64_t timeout_ns, uint64_t now_ns);

/* Poll the counter; returns 1 if no progress for >= timeout_ns. */
int lp_watchdog_expired(struct lp_watchdog *w, uint64_t now_ns);

uint64_t lp_watchdog_counter(struct lp_watchdog *w);
uint32_t lp_watchdog_overflow(struct lp_watchdog *w);
uint64_t lp_watchdog_dropped(struct lp_watchdog *w);
uint32_t lp_watchdog_threads_seen(struct lp_watchdog *w);

void lp_watchdog_close(struct lp_watchdog *w);

#endif /* LOCKPULSE_WATCHDOG_H */
