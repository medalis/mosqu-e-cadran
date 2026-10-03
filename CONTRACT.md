# Nidaa — contrat entre l'API, le back-office et l'écran

Ce fichier est la référence pour les trois applications. Les types et schémas Zod vivent dans
`packages/shared/src/index.ts` ; le calcul des horaires dans `packages/prayer-engine/src/index.ts`.
Le schéma de base est `apps/api/prisma/schema.prisma`. Ne pas dupliquer ces définitions.

## Conventions
- Préfixe `/v1`. JSON. Erreurs : `{ statusCode, message, error }` (format Nest par défaut).
- Auth back-office : `Authorization: Bearer <accessToken>` (JWT 15 min) ; refresh par `POST /v1/auth/refresh { refreshToken }`.
- Auth écran : `Authorization: Bearer <deviceToken>` (jeton opaque remis à l'appairage, haché en base).
- Heures « HH:MM » en heure locale de la mosquée (`mosque.timezone`). Dates « YYYY-MM-DD ».
- Toute modification visible incrémente `mosque.version` et publie un événement SSE `{ type:"version", version }`.

## Endpoints MVP

### Auth
| Méthode | Chemin | Corps / réponse |
|---|---|---|
| POST | /v1/auth/register | `RegisterSchema` → `{ user: Me, tokens: AuthTokens }` |
| POST | /v1/auth/login | `LoginSchema` → `{ user: Me, tokens: AuthTokens }` |
| POST | /v1/auth/refresh | `{ refreshToken }` → `AuthTokens` |
| POST | /v1/auth/logout | `{ refreshToken }` → 204 |
| GET | /v1/me | `Me` |

### Back-office — `/v1/admin/mosques` (JWT ; rôle requis sur la mosquée pour les sous-chemins)
| Méthode | Chemin | Corps / réponse |
|---|---|---|
| GET | / | `Mosque[]` (mes mosquées) |
| POST | / | `MosqueInputSchema` → `Mosque` (statut `draft`, créateur = `owner`, crée PrayerConfig + ScreenSettings par défaut, résout 400 jours) |
| GET | /:id | `Mosque` + `members`, `prayerConfig`, `iqamaRules`, `jumuaSlots`, `screenSettings`, `flashMessage` |
| PATCH | /:id | `MosqueInputSchema.partial()` → `Mosque` |
| POST | /:id/submit | → `Mosque` (draft → pending) |
| GET/PUT | /:id/prayer-config | `PrayerConfigSchema` → recalcul prayer_day (hors jours `calendar`/`override`) |
| POST | /:id/prayer-config/preview | `{ config?: PrayerConfig, iqamaRules?: IqamaRule[], from?: "YYYY-MM-DD", days?: number≤31 }` → `PrayerDay[]` (sans écrire) |
| GET/PUT | /:id/iqama-rules | `IqamaRulesSchema` → recalcul |
| GET/PUT | /:id/jumua | `JumuaSlot[]` |
| GET/POST/PATCH/DELETE | /:id/special-prayers[/:spId] | `SpecialPrayerSchema` |
| POST | /:id/calendar/import | `{ csv: string, fileName?: string }` → `{ imported, errors[] }` ; les lignes valides deviennent des `prayer_day` source `calendar` |
| GET | /:id/calendar/template | `text/csv` |
| GET | /:id/prayer-days?from&to | `PrayerDay[]` |
| PATCH | /:id/prayer-days/:date | `{ times?: Partial<times>, iqama?: Partial<iqama> }` → `PrayerDay` source `override` |
| DELETE | /:id/prayer-days/:date/override | → recalcul du jour |
| GET/POST/PATCH/DELETE | /:id/announcements[/:aId] | `AnnouncementInputSchema` |
| GET/PUT | /:id/flash-message | `{ text, isActive }` |
| GET | /:id/media?kind= | `Media[]` (`{ id, mosqueId, kind, url, mime, size, width, height, position, createdAt }`), triées par `position` ; `kind` = `photo` \| `announcement_image` (sans filtre : tout) |
| POST | /:id/media | `multipart/form-data` : champ `file`, champ facultatif `kind` (défaut `photo`) → `Media` (201). JPEG/PNG/WebP uniquement (octets magiques), 5 Mo max, 12 photos max par mosquée (60 images d'annonce). 400 format/limite, 413 taille, 503 stockage indisponible. `photo` : rôle owner/admin ; `announcement_image` : tout membre |
| PATCH | /:id/media/order | `{ ids: string[] }` (toutes les photos de la mosquée, dans le nouvel ordre) → `Media[]` (owner/admin) |
| DELETE | /:id/media/:mediaId | 204 — supprime l'objet stocké et la ligne |
| GET/PUT | /:id/screen-settings | `ScreenSettingsSchema` |
| GET | /:id/screens | `ScreenDevice[]` |
| POST | /:id/screens/claim | `{ code, name? }` → `ScreenDevice` |
| DELETE | /:id/screens/:sid | 204 |
| GET/POST/PATCH/DELETE | /:id/members[/:mId] | `{ email, role }` (l'utilisateur doit exister) |
| GET | /:id/audit-log?limit | `AuditLog[]` |

### Super-admin — `/v1/super` (JWT + isSuperAdmin)
| GET | /mosques?status= | `Mosque[]` |
| POST | /mosques/:id/approve · /reject `{ reason }` · /suspend | `Mosque` |
| GET/POST/PATCH/DELETE | /content-items[/:id] | `ContentItem` |
| GET | /stats | `{ mosques, published, screensOnline, users }` |

### Écran — `/v1/screen`
| POST | /pairing | `{ appVersion? }` → `{ code: "ABC123", expiresAt, pollToken }` (code 6 car. sans ambiguïté, 10 min) |
| GET | /pairing/:code?pollToken= | 202 `{ status:"waiting" }` tant que non associé ; 200 `{ deviceToken, mosqueId }` une fois réclamé dans le back-office |
| GET | /bundle | (jeton appareil) `ScreenBundle` ; `ETag: "<version>"`, 304 si `If-None-Match` correspond. 30 jours à partir d'hier. |
| GET | /events | (jeton appareil, aussi accepté en `?token=`) SSE : `version` à chaque changement + `ping` toutes les 25 s |
| POST | /heartbeat | `{ appVersion, clockDriftMs, bundleVersion }` → 204 |

### Public
| GET | /v1/mosques?q&city&lat&lng&radiusKm | `Mosque[]` publiées (résumé + distance si lat/lng) |
| GET | /v1/mosques/:slug | fiche publique + `jumua`, `services`, `photos: [{ id, url, width, height }]` (ordre choisi par la mosquée, la première est la photo principale) |
| GET | /v1/files/* | fichiers du pilote de stockage `local` (images, cache immuable) ; 404 avec le pilote `supabase`, dont les URL pointent vers Supabase Storage |
| GET | /v1/mosques/:slug/times?date= | `PrayerDay` + `{ next: { prayer, at } }` |
| GET | /v1/mosques/:slug/calendar?month=YYYY-MM | `PrayerDay[]` |
| GET | /v1/mosques/:slug/announcements | annonces actives, cible `web` |
| GET | /v1/mosques/:slug/events | SSE public |
| GET | /v1/time | `{ now: ISO }` |

### CORS et limite de débit
- **Public en lecture** (`/v1/mosques*`, flux SSE `/v1/mosques/:slug/events` compris, et `/v1/time`) : `Access-Control-Allow-Origin: *`, sans identifiants, méthodes `GET/HEAD/OPTIONS`. Appelable depuis n'importe quel site (widget intégrable, sites tiers) ; le navigateur ouvre son `EventSource` directement sur l'API.
- **Tout le reste** (`/v1/auth`, `/v1/me`, `/v1/admin`, `/v1/super`, `/v1/screen`) : uniquement les origines de `CORS_ORIGINS` (back-office et écran), avec identifiants. Liste vide : tout accepté en développement, rien si `NODE_ENV=production`.
- Routes publiques limitées à **120 requêtes/min par IP** (`PUBLIC_RATE_LIMIT`, réponse 429, en-têtes `X-RateLimit-*`) ; le flux SSE n'est pas compté. L'IP est `req.ip` avec `trust proxy` = `TRUST_PROXY` (défaut `1` : un reverse proxy). Le serveur du site public s'exempte avec l'en-tête `X-Internal-Token` = `INTERNAL_API_TOKEN`.
- Swagger (`/docs`) : `SWAGGER_ENABLED` — actif par défaut en développement, désactivé par défaut si `NODE_ENV=production`.

### Médias et stockage
- `STORAGE_DRIVER=local` (défaut) : fichiers sous `STORAGE_LOCAL_DIR`, URL `${PUBLIC_API_URL}/v1/files/<clé>`. `STORAGE_DRIVER=supabase` : Supabase Storage (API REST, clé de service), compartiment public `STORAGE_BUCKET` (`nidaa-media`), URL `${SUPABASE_URL}/storage/v1/object/public/<compartiment>/<clé>`.
- Clé d'objet : `mosques/<mosqueId>/<uuid>.<ext>` (`jpg` \| `png` \| `webp`, d'après le contenu réel du fichier).
- `Media.url` est l'URL publique complète ; une image d'annonce s'utilise en la recopiant dans `Announcement.mediaUrl`.
- Comme toute mutation d'administration : ligne dans le journal et incrément de `mosque.version`.

## Règles métier
- `resolveRange` (prayer-engine) écrit `prayer_day` sur 400 jours à partir d'hier à chaque changement de config/iqama/import. Les jours `override` ne sont jamais écrasés ; les jours `calendar` ne sont écrasés que par un nouvel import.
- Une mosquée n'apparaît en public (et à l'écran) que si `status = published` ; l'écran d'une mosquée `draft`/`pending` reçoit quand même le bundle (pour tester en salle).
- `ScreenBundle.contentItems` = tous les `ContentItem` actifs. `announcements` = actives, dans la fenêtre de dates, cible `screen`.
- Thèmes écran : `nuit | emeraude | bordeaux | ottoman | sable | ivoire`.

## Comptes de démonstration (seed)
- Super-admin : `admin@nidaa.dj` / `Nidaa2026!`
- Responsable : `imam@al-rahma.dj` / `Nidaa2026!` — mosquée « Mosquée Al-Rahma » (slug `al-rahma`, Djibouti, 11.588 / 43.145), publiée, config MWL, iqama 20/15/15/5/15, 2 annonces, flash, 6 contenus.
