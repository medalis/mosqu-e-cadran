# @nidaa/api — API NestJS de Nidaa

Implémente l'intégralité des endpoints de [`CONTRACT.md`](../../CONTRACT.md) : Auth, back-office (`/v1/admin/mosques`),
super-admin (`/v1/super`), écran (`/v1/screen`) et public (`/v1/mosques`, `/v1/time`). Swagger sur `/docs`.

## Stack
- NestJS 11 (Express), TypeScript 5.9, sortie CommonJS (`module: NodeNext`) — les paquets `@nidaa/shared` et
  `@nidaa/prayer-engine` sont ESM et chargés via `require(esm)` → **Node ≥ 22.12 requis**.
- Prisma 6.19 avec l'adaptateur `pg` (`@prisma/adapter-pg`) et le moteur de requêtes WASM embarqué
  (`engineType = "client"`) : aucun binaire natif Prisma à télécharger à l'exécution.
- argon2 (mots de passe), JWT d'accès 15 min + jetons de rafraîchissement opaques (hachés, rotation),
  jetons appareil opaques pour les écrans, validation Zod (schémas de `@nidaa/shared`).
- SSE : `VersionEventsService` — pub/sub Redis si `REDIS_URL` est défini, sinon EventEmitter en mémoire.
- Photos : `StorageService` avec deux pilotes — `local` (disque, servi sur `/v1/files/*`) et `supabase` (Supabase
  Storage par son API REST avec la clé de service : `fetch` natif, aucune dépendance ajoutée, un seul secret ; l'accès
  compatible S3 aurait imposé le SDK AWS et une paire de clés supplémentaire). Validation par octets magiques.
- Distance géographique : haversine en JS (pré-filtre par boîte englobante en SQL) — pas de PostGIS requis.

## Démarrage

```bash
# à la racine du monorepo
pnpm install
pnpm --filter @nidaa/shared build && pnpm --filter @nidaa/prayer-engine build

cd apps/api
cp ../../.env.example .env        # puis ajuster DATABASE_URL, JWT_SECRET, CORS_ORIGINS…
pnpm prisma:generate
pnpm prisma:migrate               # prisma migrate dev --name init (ou : pnpm prisma:deploy en prod)
                                  # les scripts prisma:* passent par scripts/with-direct-url.mjs : DIRECT_URL absent → DATABASE_URL
pnpm prisma:seed                  # comptes de démo (voir ci-dessous)
pnpm dev                          # http://localhost:4000/v1 — Swagger : http://localhost:4000/docs
```

Si le téléchargement des moteurs Prisma (`binaries.prisma.sh`) est impossible sur votre réseau, appliquez les
migrations avec `DATABASE_URL=… scripts/apply-migrations.sh` (psql ; utilise `DIRECT_URL` s'il est défini ; enregistre aussi `_prisma_migrations`) et
lancez `prisma generate` avec `PRISMA_SCHEMA_ENGINE_BINARY=/bin/false` (le client généré n'en a pas besoin).

### Scripts
| Script | Rôle |
|---|---|
| `build` / `dev` / `start` | `nest build` · `nest start --watch` · `node dist/main.js` |
| `typecheck` · `test` | `tsc --noEmit` · `vitest run` |
| `prisma:generate` · `prisma:migrate` · `prisma:deploy` · `prisma:seed` | client · migration dev · migrations prod · jeu de démo |
| `prisma:seed-content` | production : bibliothèque de contenus seule (aucun compte, aucune mosquée) |
| `prisma:create-admin` | production : crée ou promeut un super-admin (`--email`, `--name`, mot de passe via `SUPER_ADMIN_PASSWORD`) |

### Variables d'environnement
`DATABASE_URL` (exécution), `DIRECT_URL` (migrations ; défaut : `DATABASE_URL`), `DB_POOL_MAX` (5), `DB_SSL` / `DB_SSL_CA` /
`DB_SSL_CA_FILE` / `DB_SSL_NO_VERIFY` (TLS vers la base), `STORAGE_DRIVER` (`local` | `supabase`), `STORAGE_LOCAL_DIR` (`storage`),
`PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET` (`nidaa-media`), `JWT_SECRET`, `JWT_ACCESS_TTL` (15m), `JWT_REFRESH_TTL` (30d), `PORT` (4000),
`CORS_ORIGINS` (liste séparée par des virgules ; routes authentifiées uniquement — le public en lecture est ouvert à toute
origine, voir `src/cors.ts`), `REDIS_URL` (optionnel), `PRISMA_LOG` (debug),
`SWAGGER_ENABLED` (défaut : `true` en développement, `false` si `NODE_ENV=production`), `TRUST_PROXY` (1),
`PUBLIC_RATE_LIMIT` (120 req/min par IP sur les routes publiques, SSE exclu), `INTERNAL_API_TOKEN` (exemption du site public),
`MIGRATE_MODE` (conteneur : `prisma` | `psql` | `none`).

### Comptes de démonstration (seed)
- Super-admin : `admin@nidaa.dj` / `Nidaa2026!`
- Responsable : `imam@al-rahma.dj` / `Nidaa2026!` — mosquée « Mosquée Al-Rahma » (`al-rahma`, publiée).

## Architecture (src/)
```
main.ts, app.module.ts, env.ts
prisma/          PrismaService (adaptateur pg) ; pg-config.ts : pool compatible pooler en mode transaction, TLS
storage/         StorageService (pilotes local / supabase), validation des images, GET /v1/files/*
media/           photos et images d'annonce : liste, envoi multipart, ordre, suppression
common/          ZodValidationPipe, décorateurs (@CurrentUser, @CurrentDevice, @Roles), AuditService,
                 AdminMutationInterceptor (journal + bump de version sur toute mutation admin), utils
events/          VersionEventsService : bump(mosqueId) · subscribe(mosqueId) → Observable SSE (version + ping 25 s)
auth/            register/login/refresh/logout/me, JwtStrategy, guards Jwt / SuperAdmin / MosqueRole / DeviceAuth
mosques/         CRUD admin, soumission, membres, journal
prayer-times/    PrayerDayService.rebuild() (400 jours dès hier, conserve calendar/override), preview, import CSV,
                 prayer-days GET/PATCH/DELETE, config, iqama, jumu'a, prières spéciales
announcements/   annonces + message flash
screens/         paramètres écran, appareils, appairage (code 6 car., 10 min), bundle (ETag/304), SSE, heartbeat
super/           file de validation, approve/reject/suspend, bibliothèque de contenus, stats
public/          recherche (q, city, lat/lng/radiusKm), fiche, horaires (+ next), calendrier, annonces, SSE
```

### Base de données derrière un pooler (Supabase)
- `DATABASE_URL` peut viser un pooler en **mode transaction** (Supavisor/PgBouncer, port 6543, `?pgbouncer=true`) :
  le pilote `pg` n'utilise que des requêtes préparées anonymes, et l'API ne dépend d'aucun état de session (ni
  `LISTEN/NOTIFY`, ni `SET`, ni verrou consultatif ; le temps réel passe par Redis ou la mémoire du processus).
  Les transactions Prisma (`$transaction`) restent sur une même connexion le temps de la transaction.
- Pool : `DB_POOL_MAX` connexions (5). Les paramètres d'URL propres à Prisma (`pgbouncer`, `connection_limit`…) et
  `sslmode` sont retirés avant d'être passés à `pg`.
- TLS : activé dès que l'hôte n'est pas local (`localhost`, IP de bouclage, ou nom sans point comme le service Docker
  `postgres`) ; certificat **vérifié** par défaut — fournir l'autorité avec `DB_SSL_CA` (PEM) ou `DB_SSL_CA_FILE`.
  `DB_SSL_NO_VERIFY=true` chiffre sans vérifier. `sslmode=disable` ou `DB_SSL=false` coupe le TLS.
- Migrations : toujours par `DIRECT_URL` (connexion de session), jamais par le pooler en mode transaction.
- Rien de ceci n'a été essayé contre un vrai projet Supabase (voir `deploy/supabase/README.md`).

### Règles d'implémentation notables
- **Version & SSE** : toute mutation `POST/PUT/PATCH/DELETE` sous `/v1/admin/mosques/:id/…` passe par
  `AdminMutationInterceptor` → ligne d'audit (`diff` = corps) puis `mosque.version + 1` et événement `version`.
  `approve/reject/suspend` côté super-admin incrémentent aussi la version.
- **Appairage** : `POST /v1/screen/pairing` crée un `ScreenDevice` avec `pairingCode` ; le `pollToken` est un HMAC
  (aucune colonne ajoutée). Le jeton appareil est généré **au premier poll après réclamation** (on ne stocke que
  son hachage) ; le code est alors consommé (poll suivant → 404).
- **Horaires** : `rebuild` supprime et réécrit tous les jours non-`override` ; les jours `calendar` gardent leurs
  horaires (iqama/hégirien recalculés) ; les jours `override` ne sont jamais touchés. Un import CSV réussi passe
  `prayerConfig.source` à `calendar`.
- **Bundle** : 30 jours à partir d'hier (fuseau de la mosquée), `ETag: "<version>"`, `304` si `If-None-Match`.
