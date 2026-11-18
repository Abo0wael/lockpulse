# LockPulse - phase 1 build.
# Linux x86-64, gcc, GNU make. Zero warnings policy: CI builds with
# EXTRA_CFLAGS=-Werror (set it locally too to reproduce CI).
#
# Recipes use '>' instead of a TAB (GNU make >= 3.82) so the file survives
# editors and platforms that mangle tabs.
.RECIPEPREFIX := >

# make's built-in default CC is "cc"; use gcc unless the caller overrides CC.
ifeq ($(origin CC),default)
CC := gcc
endif
PYTHON   ?= python3
CFLAGS   := -std=c11 -Wall -Wextra -O2 -g -D_GNU_SOURCE $(EXTRA_CFLAGS)
LDLIBS_T := -pthread

BUILD    := build
SHIM     := $(BUILD)/liblockpulse.so
LAUNCHER := $(BUILD)/lp-run
DUMP     := $(BUILD)/lp-dump
BENCHES  := two_lock_inversion lost_wakeup high_contention long_critical_section
BENCH_BINS := $(addprefix $(BUILD)/bench/,$(BENCHES))

TRACEBUF_SRC := runtime/tracebuf.c
TRACEBUF_HDR := runtime/tracebuf.h

.PHONY: all shim launcher bench tools clean check-phase1

all: shim launcher bench tools

shim: $(SHIM)
launcher: $(LAUNCHER)
bench: $(BENCH_BINS)
tools: $(DUMP)

# -fvisibility=hidden: only the interposed pthread_* symbols are exported.
$(SHIM): runtime/shim.c $(TRACEBUF_SRC) $(TRACEBUF_HDR)
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -shared -fPIC -fvisibility=hidden -o $@ runtime/shim.c $(TRACEBUF_SRC) -ldl -pthread

$(LAUNCHER): launcher/launcher.c launcher/sampler.c launcher/sampler.h launcher/watchdog.c launcher/watchdog.h $(TRACEBUF_SRC) $(TRACEBUF_HDR)
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -Iruntime -o $@ launcher/launcher.c launcher/sampler.c launcher/watchdog.c $(TRACEBUF_SRC)

$(DUMP): tools/lp-dump.c $(TRACEBUF_SRC) $(TRACEBUF_HDR)
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -Iruntime -o $@ tools/lp-dump.c $(TRACEBUF_SRC)

$(BUILD)/bench/%: bench/%.c bench/bench_common.h
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -o $@ $< $(LDLIBS_T)

check-phase1: all
>$(PYTHON) scripts/check_phase1.py

# Never touches data/: raw data is immutable.
clean:
>rm -rf $(BUILD)
