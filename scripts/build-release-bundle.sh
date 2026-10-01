#!/usr/bin/env bash
# =============================================================================
# Forge Central — Standalone Release Bundle Builder (air-gapped installs)
# Usage: scripts/build-release-bundle.sh [--version <VERSION>] [--output-dir <DIR>] [--dry-run]
# Produces: <output-dir>/forge-central-v<VERSION>.tar.gz and a matching .sha256 file.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${REPO_ROOT}/dist-release"
VERSION=""
DRY_RUN=false

usage() {
  echo "Usage: $0 [--version <VERSION>] [--output-dir <DIR>] [--dry-run]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:?--version requires a value}"; shift 2 ;;
    --output-dir) OUTPUT_DIR="${2:?--output-dir requires a value}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "${VERSION}" ]]; then
  VERSION="$(sed -n 's/^[[:space:]]*control_plane_version: str = "\([^"]*\)".*/\1/p' "${REPO_ROOT}/api/app/config.py" | head -n 1)"
fi
if [[ -z "${VERSION}" ]]; then
  echo "Unable to determine version from api/app/config.py; pass --version <VERSION>" >&2
  exit 1
fi

ARCHIVE_NAME="forge-central-v${VERSION}.tar.gz"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"
CONTENTS=(api/app api/requirements.txt ui/dist docs README.md Dockerfile docker-compose.yml scripts)

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[dry-run] version: ${VERSION}"
  if [[ -d "${REPO_ROOT}/ui/dist" ]]; then
    echo "[dry-run] ui/dist found; frontend build skipped"
  else
    echo "[dry-run] would run: npm --prefix ui run build"
  fi
  echo "[dry-run] would create: ${ARCHIVE_PATH}"
  echo "[dry-run] would include: ${CONTENTS[*]}"
  echo "[dry-run] would write checksum: ${ARCHIVE_PATH}.sha256"
  exit 0
fi

if [[ ! -d "${REPO_ROOT}/ui/dist" ]]; then
  echo "ui/dist not found; building frontend..."
  npm --prefix "${REPO_ROOT}/ui" run build
fi

mkdir -p "${OUTPUT_DIR}"
tar -czf "${ARCHIVE_PATH}" -C "${REPO_ROOT}" \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='.DS_Store' \
  "${CONTENTS[@]}"
echo "$(sha256_of "${ARCHIVE_PATH}")  ${ARCHIVE_NAME}" > "${ARCHIVE_PATH}.sha256"

echo "Release bundle: ${ARCHIVE_PATH}"
echo "Checksum file:  ${ARCHIVE_PATH}.sha256"
