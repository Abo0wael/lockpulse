# LockPulse - build and pipeline entry points (phase 2).
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
SELFTEST := $(BUILD)/tests/shim_selftest
BENCHES  := two_lock_inversion three_thread_cycle dining_philosophers lost_wakeup \
            prodcons_missing_signal barrier_mismatch sem_never_posted \
            high_contention long_critical_section consistent_lock_order \
            sleeping_workers prodcons_correct blocked_on_io
BENCH_BINS := $(addprefix $(BUILD)/bench/,$(BENCHES))

TRACEBUF_SRC := runtime/tracebuf.c
TRACEBUF_HDR := runtime/tracebuf.h

# collect / labels options, e.g. make collect FAMILY=lost_wakeup SEEDS=1-3
FAMILY   ?=
SEEDS    ?=
COLLECT_ARGS := $(if $(FAMILY),--family $(FAMILY)) $(if $(SEEDS),--seeds $(SEEDS))

.PHONY: all shim launcher bench tools selftest clean \
        check-phase1 check-phase2 check-shim test-ml collect labels review overhead \
        venv phase3

all: shim launcher bench tools selftest

shim: $(SHIM)
launcher: $(LAUNCHER)
bench: $(BENCH_BINS)
tools: $(DUMP)
selftest: $(SELFTEST)

# -fvisibility=hidden: only the interposed pthread_* / sem_* symbols are exported.
$(SHIM): runtime/shim.c $(TRACEBUF_SRC) $(TRACEBUF_HDR)
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -shared -fPIC -fvisibility=hidden -o $@ runtime/shim.c $(TRACEBUF_SRC) -ldl -pthread

$(LAUNCHER): launcher/launcher.c launcher/sampler.c launcher/sampler.h launcher/watchdog.c launcher/watchdog.h $(TRACEBUF_SRC) $(TRACEBUF_HDR)
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -Iruntime -o $@ launcher/launcher.c launcher/sampler.c launcher/watchdog.c $(TRACEBUF_SRC)

$(DUMP): tools/lp-dump.c $(TRACEBUF_SRC) $(TRACEBUF_HDR)
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -Iruntime -o $@ tools/lp-dump.c $(TRACEBUF_SRC)

$(SELFTEST): runtime/tests/shim_selftest.c
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -o $@ $< $(LDLIBS_T)

$(BUILD)/bench/%: bench/%.c bench/bench_common.h
>@mkdir -p $(@D)
>$(CC) $(CFLAGS) -o $@ $< $(LDLIBS_T)

# ---- gates and tests -------------------------------------------------------
check-phase1: all
>$(PYTHON) scripts/check_phase1.py

check-phase2: all
>$(PYTHON) scripts/check_phase2.py

check-shim: all
>$(PYTHON) scripts/check_phase2.py --shim-only

test-ml:
>$(PYTHON) -m unittest discover -s ml/tests -v

# ---- dataset pipeline (phase 2) ---------------------------------------------
collect: all
>$(PYTHON) scripts/collect.py $(COLLECT_ARGS)

labels:
>$(PYTHON) ml/label.py --summary results/labels_summary.txt

review: labels
>$(PYTHON) scripts/review_sample.py

overhead: all
>$(PYTHON) scripts/overhead.py

# ---- phase 3: features and models (pure Python, runs on any OS) -------------
# Uses the pinned venv (.venv) if present: make venv && make phase3
VENV_PY := $(firstword $(wildcard .venv/bin/python .venv/Scripts/python.exe))
ML_PY   := $(if $(VENV_PY),$(VENV_PY),$(PYTHON))

venv:
>$(PYTHON) -m venv .venv
>$(firstword $(wildcard .venv/bin/python .venv/Scripts/python.exe)) -m pip install -r requirements-ml.txt

phase3:
>$(ML_PY) -m ml.phase3

# Never touches data/: raw data is immutable.
clean:
>rm -rf $(BUILD)
