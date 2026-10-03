#!/usr/bin/env bash
# Sauvegarde PostgreSQL de Nidaa : pg_dump compressé et daté, conservation 14 jours.
#   ./backup.sh                 → écrit ${BACKUP_DIR}/nidaa-AAAAMMJJ-HHMMSS.sql.gz
# Cron (tous les jours à 02h30, utilisateur ayant accès à Docker) :
#   30 2 * * * /opt/nidaa/deploy/backup.sh >> /var/log/nidaa-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "deploy/.env introuvable" >&2; exit 1; }
# Seules les deux variables utiles sont lues (le fichier .env n'est pas exécuté).
read_env() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
BACKUP_DIR="${BACKUP_DIR:-$(read_env BACKUP_DIR)}"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/nidaa}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-$(read_env BACKUP_KEEP_DAYS)}"; KEEP_DAYS="${KEEP_DAYS:-14}"

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/nidaa-$(date +%Y%m%d-%H%M%S).sql.gz"
tmp="$file.partiel"
trap 'rm -f "$tmp"' EXIT

# --clean --if-exists : la sauvegarde peut être rejouée sur une base existante (voir README, « Restaurer »).
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U nidaa -d nidaa --no-owner --no-privileges --clean --if-exists | gzip -9 > "$tmp"

gzip -t "$tmp"
[ "$(stat -c %s "$tmp")" -gt 1000 ] || { echo "Sauvegarde anormalement petite : abandon" >&2; exit 1; }
mv "$tmp" "$file"
trap - EXIT

find "$BACKUP_DIR" -maxdepth 1 -name 'nidaa-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) sauvegarde OK : $file ($(du -h "$file" | cut -f1)) — conservation ${KEEP_DAYS} jours"
