#!/usr/bin/env bash
# Run the full-stack hybrid Playwright E2E suite headlessly (see docs/E2E-PLAYWRIGHT-TESTING-GUIDE.md).
#
#   ./scripts/run-e2e-suite.sh --mode ui-only
#   ./scripts/run-e2e-suite.sh --mode live-proxmox --conf tests/e2e/test-config.ini
#
# Output (tests/e2e/reports/): report.html, run.log, artifacts/ (traces + failure screenshots).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE=""
CONF=""

usage() {
  echo "Usage: $0 [--mode ui-only|dry-run|live-proxmox] [--conf <test-config.ini>] [-- <extra pytest args>]"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="${2:?--mode needs a value}"; shift 2 ;;
    --conf) CONF="${2:?--conf needs a path}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -n "${CONF}" ]; then
  case "${CONF}" in /*) ;; *) CONF="${PWD}/${CONF}" ;; esac
  [ -f "${CONF}" ] || { echo "Config not found: ${CONF}" >&2; exit 2; }
  export FORGE_E2E_CONF="${CONF}"
fi
[ -z "${MODE}" ] || export FORGE_E2E_MODE="${MODE}"

# Prefer the project E2E virtualenv and the repo-local (native arch) Playwright browsers when present.
PYTHON="python3"
[ -x "${REPO_ROOT}/.venv-e2e/bin/python" ] && PYTHON="${REPO_ROOT}/.venv-e2e/bin/python"
[ -d "${REPO_ROOT}/.playwright-browsers" ] && export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-${REPO_ROOT}/.playwright-browsers}"
[ -d "${REPO_ROOT}/ui/node_modules" ] || (cd "${REPO_ROOT}/ui" && npm ci)

REPORT_DIR="${REPO_ROOT}/tests/e2e/reports"
rm -rf "${REPORT_DIR}"
mkdir -p "${REPORT_DIR}"

echo "==> E2E mode: ${FORGE_E2E_MODE:-<from config>}  config: ${FORGE_E2E_CONF:-tests/e2e/test-config.ini}"
cd "${REPO_ROOT}"
set +e
"${PYTHON}" -m pytest tests/e2e/test_full_stack_cluster_deploy.py tests/e2e/test_e2e_harness_unit.py \
  --browser chromium \
  --tracing retain-on-failure \
  --screenshot only-on-failure \
  --output "${REPORT_DIR}/artifacts" \
  --html="${REPORT_DIR}/report.html" --self-contained-html \
  -p no:cacheprovider "$@" 2>&1 | tee "${REPORT_DIR}/run.log"
STATUS=${PIPESTATUS[0]}
set -e

echo "==> Report: ${REPORT_DIR}/report.html (exit ${STATUS})"
exit "${STATUS}"
