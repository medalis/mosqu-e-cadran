#!/usr/bin/env bash
# Repli sans schema-engine Prisma : applique les migrations SQL avec psql et les enregistre dans _prisma_migrations
# (équivalent de `prisma migrate deploy`). Usage : DATABASE_URL=postgresql://... scripts/apply-migrations.sh
# Utilise DIRECT_URL s'il est défini (Supabase : port 5432, jamais le pooler en mode transaction), sinon DATABASE_URL.
set -euo pipefail
cd "$(dirname "$0")/.."
DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
: "${DB_URL:?DIRECT_URL ou DATABASE_URL requis}"
# psql (libpq) refuse les paramètres d'URL propres à Prisma : on les retire.
DB_URL=$(printf '%s' "$DB_URL" | sed -E ':a; s/([?&])(pgbouncer|connection_limit|pool_timeout|schema)=[^&]*&?/\1/; ta; s/[?&]$//')
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL,
  logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0
);
SQL
for dir in prisma/migrations/*/; do
  name=$(basename "$dir")
  [ -f "$dir/migration.sql" ] || continue
  applied=$(psql "$DB_URL" -tAc "select 1 from \"_prisma_migrations\" where migration_name='$name' and finished_at is not null")
  if [ "$applied" = "1" ]; then echo "= $name (déjà appliquée)"; continue; fi
  checksum=$(sha256sum "$dir/migration.sql" | cut -d' ' -f1)
  id=$(cat /proc/sys/kernel/random/uuid)
  echo "> $name"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -1 -f "$dir/migration.sql"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "insert into \"_prisma_migrations\"(id, checksum, finished_at, migration_name, applied_steps_count) values ('$id','$checksum',now(),'$name',1)"
done
echo "Migrations appliquées."
