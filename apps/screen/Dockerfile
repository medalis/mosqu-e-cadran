# syntax=docker/dockerfile:1
# Image de l'écran TV Nidaa (PWA Vite servie par Caddy). Contexte de build : racine du monorepo.
#   docker build -f apps/screen/Dockerfile --build-arg VITE_API_URL=https://api.exemple.dj -t nidaa-screen .
# VITE_API_URL est figée à la compilation.

FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/prayer-engine/package.json packages/prayer-engine/
COPY apps/screen/package.json apps/screen/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --filter "@nidaa/screen..."
COPY packages/shared packages/shared
COPY packages/prayer-engine packages/prayer-engine
COPY apps/screen apps/screen
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @nidaa/shared build && pnpm --filter @nidaa/prayer-engine build && pnpm --filter @nidaa/screen build

FROM caddy:2-alpine AS runtime
# Caddy sans privilèges : port 8080, pas d'API d'administration, états dans /tmp.
ENV XDG_CONFIG_HOME=/tmp/caddy-config XDG_DATA_HOME=/tmp/caddy-data
COPY apps/screen/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/screen/dist /srv
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --retries=5 CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
