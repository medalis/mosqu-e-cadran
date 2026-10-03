# Nidaa — نداء

Plateforme de mosquée connectée : chaque mosquée gère ses horaires de prière réels (adhan et iqama) et les diffuse sur l'écran de la salle de prière, sur le web et, en phase 2, sur mobile.

**État : MVP (phase 1)** — back-office, API, écran TV et API publique fonctionnent de bout en bout. Dossier de conception et décisions : voir le projet Claude « Projet mosquée connecté ».

## Organisation du dépôt

| Dossier | Rôle | Stack |
| --- | --- | --- |
| `packages/shared` | Types et schémas Zod partagés (contrat API ↔ clients) | TypeScript, Zod |
| `packages/prayer-engine` | Calcul et résolution des horaires, iqama, hégirien, machine à états de l'écran, import CSV | TypeScript, `adhan` |
| `apps/api` | API REST `/v1` + SSE, auth, rôles, journal, appairage écran, photos (stockage local ou Supabase Storage) | NestJS 11, Prisma 6, PostgreSQL, Redis (optionnel) |
| `apps/admin` | Back-office responsable de mosquée et super-admin | Next.js 15, React 19, Tailwind 4, TanStack Query |
| `apps/screen` | Écran TV plein écran, hors ligne, 6 thèmes | Vite 6, React 19, PWA, IndexedDB |
| `apps/tv` | Application Android TV : WebView plein écran en mode kiosque, démarrage au boot, son d'adhan sans geste | Kotlin, Gradle |
| `apps/web` | Site public : recherche, page par mosquée (SEO, calendrier mensuel), widget iframe `/m/:slug/embed` — port 3001 | Next.js 15, React 19, Tailwind 4 |

Le contrat entre les applications est décrit dans [`CONTRACT.md`](./CONTRACT.md). Le modèle de données est `apps/api/prisma/schema.prisma`.

## Démarrage rapide

Prérequis : Node ≥ 22.12, pnpm 10, Docker (pour PostgreSQL et Redis).

```bash
pnpm install
cp .env.example apps/api/.env
cp apps/admin/.env.local.example apps/admin/.env.local

pnpm db:up                                  # PostgreSQL + Redis
pnpm --filter @nidaa/api prisma:generate
pnpm --filter @nidaa/api prisma:deploy      # applique prisma/migrations
pnpm db:seed                                # comptes et mosquée de démonstration

pnpm dev                                    # api :4000 · admin :3000 · screen :5173
```

Comptes de démonstration :

- Responsable : `imam@al-rahma.dj` / `Nidaa2026!` (Mosquée Al-Rahma, Djibouti)
- Super-admin : `admin@nidaa.dj` / `Nidaa2026!`

Parcours de test : ouvrir `http://localhost:5173` sur l'écran (ou une TV), relever le code à 6 caractères, se connecter au back-office `http://localhost:3000`, menu **Écrans → Associer un écran**, saisir le code. L'écran bascule sur l'affichage en quelques secondes ; toute modification du back-office (horaires, annonces, thème) apparaît sur l'écran en moins d'une minute (SSE, filet de secours par interrogation toutes les 60 s).

Documentation de l'API : `http://localhost:4000/docs`.

## Principes de conception

- **L'horaire de la mosquée fait foi.** Le calcul astronomique n'est qu'une proposition ; un calendrier importé (CSV) ou une correction manuelle d'un jour prime toujours, et n'est jamais écrasé par un recalcul.
- **Une seule source de vérité.** Le serveur résout les horaires jour par jour dans `prayer_day` (400 jours glissants). L'écran, la page publique et l'application ne lisent que cette table.
- **L'écran ne dépend pas du réseau.** Il met en cache 30 jours d'horaires et toute sa configuration ; au-delà, il recalcule localement avec `prayer-engine`. Il mesure et remonte l'écart de son horloge.

## Commandes utiles

```bash
pnpm typecheck            # toutes les applications
pnpm test                 # prayer-engine (11 tests) + api (31 tests : validation des images, stockage, pool PostgreSQL…)
node e2e/photos.cjs       # bout en bout des photos (API, back-office et site démarrés ; voir l'en-tête du fichier)
pnpm build
pnpm --filter @nidaa/api prisma:migrate   # créer une migration après modification du schéma
```

## Déploiement

Deux options, avec le même code (seules les variables d'environnement changent) :

1. **Supabase + hébergeurs managés** (option retenue pour le pilote) — PostgreSQL et photos chez Supabase, API en conteneur sur Render ([`render.yaml`](./render.yaml) ; notes pour Railway et Fly.io), back-office, site public et écran sur Vercel (`apps/*/vercel.json`). Guide pas à pas : [`deploy/supabase/README.md`](./deploy/supabase/README.md) — création du projet, migrations, RLS ([`enable-rls.sql`](./deploy/supabase/enable-rls.sql)), stockage, variables, DNS, contrôles, sauvegardes, limites. Écrit et testé en local uniquement : jamais exécuté sur les vrais services.
2. **VM unique** — une VM Linux avec Docker (PostgreSQL, Redis, API, back-office, site public, écran, reverse proxy Caddy avec HTTPS automatique) : voir [`deploy/README.md`](./deploy/README.md) — DNS, pare-feu, premier démarrage, création du super-admin, sauvegardes, mises à jour et liste de contrôle sécurité. Chaque application a son `Dockerfile` (`apps/*/Dockerfile`, contexte de build = racine du dépôt).

Base de données : `DATABASE_URL` sert à l'exécution, `DIRECT_URL` aux migrations (identiques en local ; sur Supabase, pooler « transaction » et pooler « session »). Photos : `STORAGE_DRIVER=local` (disque, défaut) ou `supabase`. L'intégration continue (`.github/workflows/ci.yml`) lance typecheck, tests et build à chaque push et pull request.

## Feuille de route

1. **Phase 1 — MVP (ce dépôt)** : back-office, écran TV, page publique minimale via l'API.
2. **Phase 2 — Application mobile** (React Native / Expo) : recherche, favoris, notifications locales, Qibla, widget.
3. **Phase 3 — Ouverture** : API publique avec clés, widget iframe, dons, annonces vidéo.

Reste à faire avant pilote : première compilation de l'APK Android TV (`apps/tv`, écrit mais jamais compilé), 2FA, premier déploiement réel (Supabase + Render + Vercel : guide et fichiers écrits, jamais exécutés sur les vrais services ; kit VM `deploy/` : images Docker jamais construites), copie des sauvegardes hors de l'hébergeur, supervision.
