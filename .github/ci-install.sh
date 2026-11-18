#!/usr/bin/env bash
# ci-install.sh - bounded, non-interactive install of what CI needs.
#
#   bash .github/ci-install.sh build    # gcc + make + objdump + python3 + pandas
#   bash .github/ci-install.sh python   # python3 + pandas only
#
# Installs only what is missing from the runner image (build-essential is
# normally preinstalled; python3-pandas is the usual only real install).
# Every apt-get call is non-interactive, waits at most 120 s for the dpkg lock,
# retries downloads 3 times with 30 s HTTP timeouts, and skips recommends.
# The step that calls this has timeout-minutes: 5 as the outer bound.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

APT_OPTS=(-o DPkg::Lock::Timeout=120 -o Acquire::Retries=3
          -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)

mode="${1:-build}"
pkgs=()
if [ "$mode" = "build" ]; then
    for tool in gcc make objdump; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            pkgs+=(build-essential binutils)
            break
        fi
    done
fi
command -v python3 >/dev/null 2>&1 || pkgs+=(python3)
if ! python3 -c 'import pandas' >/dev/null 2>&1; then
    pkgs+=(python3-pandas)
fi

echo "present: $(command -v gcc make objdump python3 2>/dev/null | tr '\n' ' ')"
if [ "${#pkgs[@]}" -eq 0 ]; then
    echo "ci-install: nothing to install"
    exit 0
fi

echo "ci-install: need ${pkgs[*]}"
sudo -E apt-get update "${APT_OPTS[@]}"

# Show exactly what will be installed (expect numpy + pandas (+ pandas-lib), no matplotlib/scipy/numba).
plan=$(apt-get install -s -y --no-install-recommends "${APT_OPTS[@]}" "${pkgs[@]}" | awk '/^Inst /{print $2}')
echo "ci-install: $(echo "$plan" | grep -c . || true) packages to install:"
echo "$plan" | sed 's/^/  /'

sudo -E apt-get install -y --no-install-recommends "${APT_OPTS[@]}" "${pkgs[@]}"
python3 -c 'import pandas, sys; print("python", sys.version.split()[0], "pandas", pandas.__version__)'
