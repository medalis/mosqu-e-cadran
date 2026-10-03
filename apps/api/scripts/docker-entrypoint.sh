#!/bin/sh
# Entrée du conteneur API : applique les migrations puis exécute la commande (par défaut : node dist/main.js).
#   MIGRATE_MODE=prisma (défaut) → prisma migrate deploy (schema-engine Prisma)
#   MIGRATE_MODE=psql            → scripts/apply-migrations.sh (repli sans moteur Prisma, via psql)
#   MIGRATE_MODE=none            → aucune migration (conteneurs ponctuels : scripts, sauvegarde…)
# Les migrations passent par DIRECT_URL (Supabase : pooler en mode session ou connexion directe, port 5432) ;
# sans DIRECT_URL (VM unique, PostgreSQL local), elles utilisent DATABASE_URL.
set -eu
cd "$(dirname "$0")/.."
export DIRECT_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
case "${MIGRATE_MODE:-prisma}" in
  prisma) echo "[entrée] prisma migrate deploy"; ./node_modules/.bin/prisma migrate deploy ;;
  psql)   echo "[entrée] scripts/apply-migrations.sh"; bash scripts/apply-migrations.sh ;;
  none)   ;;
  *)      echo "MIGRATE_MODE invalide : ${MIGRATE_MODE} (prisma | psql | none)" >&2; exit 64 ;;
esac
exec "$@"
