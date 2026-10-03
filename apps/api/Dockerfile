# syntax=docker/dockerfile:1
# Image de l'API Nidaa. Contexte de build : racine du monorepo.
#   docker build -f apps/api/Dockerfile -t nidaa-api .
# Node 22 requis (require(esm) des paquets @nidaa/* du monorepo).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

# --- Compilation : toutes les dépendances (dev comprises) + outils de build natifs (repli si argon2 n'a pas de binaire précompilé)
FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/prayer-engine/package.json packages/prayer-engine/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --filter "@nidaa/api..."
COPY packages/shared packages/shared
COPY packages/prayer-engine packages/prayer-engine
COPY apps/api apps/api
RUN pnpm --filter @nidaa/shared build && pnpm --filter @nidaa/prayer-engine build \
 && pnpm --filter @nidaa/api prisma:generate && pnpm --filter @nidaa/api build
# (Les sources sont retirées de l'image, sauf src/prisma/pg-config.ts : les scripts prisma/*.ts l'importent.)
# Arborescence autonome de production dans /out : dépendances de prod uniquement (dont la CLI prisma et tsx, utilisés
# au démarrage et par les scripts d'initialisation), paquets @nidaa/* copiés et non liés.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm --filter @nidaa/api deploy --prod --legacy /out
WORKDIR /out
# Client Prisma généré dans l'arborescence finale ; « prisma version » force le téléchargement du schema-engine
# (utilisé par « prisma migrate deploy ») pendant le build plutôt qu'au premier démarrage. Si binaries.prisma.sh est
# inaccessible : construire avec --build-arg PRISMA_OFFLINE=1 et démarrer avec MIGRATE_MODE=psql (voir deploy/README.md).
ARG PRISMA_OFFLINE=
RUN if [ -n "$PRISMA_OFFLINE" ]; then \
      PRISMA_SCHEMA_ENGINE_BINARY=/bin/false PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 ./node_modules/.bin/prisma generate; \
    else \
      ./node_modules/.bin/prisma generate && ./node_modules/.bin/prisma version; \
    fi \
 && find src -type f ! -path "src/prisma/pg-config.ts" -delete && find src -type d -empty -delete \
 && rm -rf test storage Dockerfile README.md nest-cli.json vitest.config.ts tsconfig.build.json .env \
 && find dist -name "*.map" -delete

# --- Exécution : image mince, utilisateur non privilégié
FROM node:22-bookworm-slim AS runtime
# openssl : Prisma ; postgresql-client : repli scripts/apply-migrations.sh (psql) ; tini : signaux et processus zombies
RUN apt-get update && apt-get install -y --no-install-recommends openssl postgresql-client tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=4000 STORAGE_LOCAL_DIR=/data/media
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Dossier du pilote de stockage « local » (STORAGE_DRIVER=local) : y monter un volume pour conserver les photos.
# Inutilisé avec STORAGE_DRIVER=supabase.
RUN mkdir -p /data/media && chown node:node /data/media
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=4s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/v1/time').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# L'entrée applique les migrations (MIGRATE_MODE=prisma | psql | none) puis lance la commande.
ENTRYPOINT ["tini", "--", "sh", "scripts/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
