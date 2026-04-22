#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${ROOT_DIR}/backups-local}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%F-%H%M%S)"
DEST_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

DB_PATH="${ROOT_DIR}/data-local/one-api.db"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.local.yml"
ENV_FILE="${ROOT_DIR}/.env.local"
LOG_DIR="${ROOT_DIR}/logs-local"

mkdir -p "${DEST_DIR}"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "Database file not found: ${DB_PATH}" >&2
  exit 1
fi

echo "Creating hot backup in ${DEST_DIR}"

# Use SQLite's online backup API to create a consistent snapshot without stopping the service.
sqlite3 "${DB_PATH}" ".backup '${DEST_DIR}/one-api.db'"

if [[ -f "${COMPOSE_FILE}" ]]; then
  cp -a "${COMPOSE_FILE}" "${DEST_DIR}/"
fi

if [[ -f "${ENV_FILE}" ]]; then
  cp -a "${ENV_FILE}" "${DEST_DIR}/"
fi

if [[ -d "${LOG_DIR}" ]]; then
  tar -czf "${DEST_DIR}/logs-local.tar.gz" -C "${ROOT_DIR}" "logs-local"
fi

(
  cd "${DEST_DIR}"
  find . -maxdepth 1 -type f ! -name 'SHA256SUMS' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)

# Remove backup directories older than the retention window.
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS}" -exec rm -rf {} +

echo "Hot backup completed: ${DEST_DIR}"
