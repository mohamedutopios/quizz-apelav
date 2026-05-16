#!/usr/bin/env bash
# =============================================================================
# Backup MySQL du quiz APELAV
# Sauvegarde dans ./backups/apelav-YYYY-MM-DD-HHMM.sql.gz
# À planifier en cron : 0 2 * * * cd /home/ec2-user/apelav-quizz && bash scripts/backup-db.sh
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

# Charge .env si présent
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

DB_NAME="${DB_NAME:-apelav_quizz}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TS="$(date +%Y-%m-%d-%H%M)"
OUT="$BACKUP_DIR/apelav-$TS.sql.gz"

echo "==> Dump MySQL → $OUT"
docker compose exec -T mysql mysqldump \
  -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction --routines --triggers --events \
  "$DB_NAME" | gzip -9 > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[OK] Backup terminé ($SIZE)"

echo "==> Nettoyage des backups > $RETENTION_DAYS jours"
find "$BACKUP_DIR" -name 'apelav-*.sql.gz' -type f -mtime +$RETENTION_DAYS -delete

echo "==> Backups conservés :"
ls -lh "$BACKUP_DIR" | tail -n +2
