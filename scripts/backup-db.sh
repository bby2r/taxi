#!/usr/bin/env bash
#
# Daily Postgres backup for AIYL Taxi.
#
# Usage:   ./scripts/backup-db.sh
# Crontab: 0 3 * * *  /var/www/aiyltaxi/scripts/backup-db.sh >> /var/log/aiyltaxi-backup.log 2>&1
#
# Behavior:
#   - Dumps the production DB to BACKUP_DIR as a gzipped pg_dump file
#     named YYYY-MM-DD_HHMMSS.sql.gz
#   - Keeps the last RETENTION_DAYS backups; deletes anything older
#   - Detects Docker vs bare-metal Postgres by checking docker-compose.yml
#   - Reads DB credentials from the project's .env file (one-source-of-truth)
#
# Override defaults via env: BACKUP_DIR=/mnt/backups RETENTION_DAYS=30 ./scripts/backup-db.sh
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/storage/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${PROJECT_DIR}/.env" ]]; then
    echo "[backup-db] .env not found at ${PROJECT_DIR}/.env" >&2
    exit 1
fi

# Read DB creds from .env without sourcing it (avoids polluting our shell
# with every other variable, some of which may have funky characters).
read_env() {
    local key="$1"
    grep -E "^${key}=" "${PROJECT_DIR}/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

DB_DATABASE="$(read_env DB_DATABASE)"
DB_USERNAME="$(read_env DB_USERNAME)"
DB_PASSWORD="$(read_env DB_PASSWORD)"

if [[ -z "${DB_DATABASE}" || -z "${DB_USERNAME}" ]]; then
    echo "[backup-db] DB_DATABASE / DB_USERNAME missing in .env" >&2
    exit 1
fi

TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
OUTPUT="${BACKUP_DIR}/${TIMESTAMP}.sql.gz"

echo "[backup-db] $(date -Is) starting dump → ${OUTPUT}"

if [[ -f "${PROJECT_DIR}/docker-compose.yml" ]] && command -v docker >/dev/null 2>&1 \
    && docker compose -f "${PROJECT_DIR}/docker-compose.yml" ps --services 2>/dev/null | grep -q '^postgres$'; then
    # Docker Postgres — exec into the container. -T disables TTY so cron can
    # pipe stdout. PGPASSWORD lives only inside the container env.
    docker compose -f "${PROJECT_DIR}/docker-compose.yml" exec -T \
        -e PGPASSWORD="${DB_PASSWORD}" \
        postgres \
        pg_dump -U "${DB_USERNAME}" -d "${DB_DATABASE}" --no-owner --clean --if-exists \
        | gzip -9 > "${OUTPUT}"
else
    # Bare-metal Postgres reachable from host.
    DB_HOST="$(read_env DB_HOST)"
    DB_PORT="$(read_env DB_PORT)"
    PGPASSWORD="${DB_PASSWORD}" \
        pg_dump -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" \
        -U "${DB_USERNAME}" -d "${DB_DATABASE}" --no-owner --clean --if-exists \
        | gzip -9 > "${OUTPUT}"
fi

BYTES="$(stat -f%z "${OUTPUT}" 2>/dev/null || stat -c%s "${OUTPUT}")"
echo "[backup-db] $(date -Is) dump finished — ${BYTES} bytes"

# Rotate: delete dumps older than RETENTION_DAYS days. Logged for the cron
# trail so a sudden drop in file count is traceable.
DELETED="$(find "${BACKUP_DIR}" -name '*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
if [[ "${DELETED}" != "0" ]]; then
    echo "[backup-db] $(date -Is) rotated out ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
fi
