# syntax=docker/dockerfile:1
# Image du site public Nidaa (Next.js, sortie « standalone »). Contexte de build : racine du monorepo.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.exemple.dj --build-arg NEXT_PUBLIC_SITE_URL=https://exemple.dj -t nidaa-web .
# Les variables NEXT_PUBLIC_* sont figées dans le JavaScript à la compilation : les changer impose de reconstruire l'image.

FROM node:22-bookworm-slim AS base
# NEXT_OUTPUT=standalone : next.config.ts ne produit .next/standalone que sur demande (inutile sur Vercel).
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/prayer-engine/package.json packages/prayer-engine/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --filter "@nidaa/web..."
COPY packages/shared packages/shared
COPY packages/prayer-engine packages/prayer-engine
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter @nidaa/shared build && pnpm --filter @nidaa/prayer-engine build && pnpm --filter @nidaa/web build

# --- Exécution : uniquement le serveur autonome tracé par Next (outputFileTracingRoot = racine du monorepo,
#     d'où le chemin apps/web/server.js) et les fichiers statiques, qui ne sont pas inclus dans standalone.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# (pas de dossier public/ dans cette application ; s'il en apparaît un : le copier vers ./apps/web/public)
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
