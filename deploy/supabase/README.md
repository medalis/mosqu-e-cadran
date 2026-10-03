# Déployer Nidaa sur Supabase + hébergeurs managés

Ce guide met Nidaa en ligne sans administrer de serveur :

| Brique | Hébergeur | Ce qu'il contient |
| --- | --- | --- |
| Base de données PostgreSQL | **Supabase** | comptes, mosquées, horaires, annonces, journal |
| Photos et images d'annonces | **Supabase Storage** | compartiment public `nidaa-media` |
| API (`apps/api`) | **Render** (conteneur Docker, toujours allumé) | décrit par [`render.yaml`](../../render.yaml) |
| Back-office (`apps/admin`) | **Vercel** | Next.js |
| Site public (`apps/web`) | **Vercel** | Next.js |
| Écran TV (`apps/screen`) | **Vercel** (ou Cloudflare Pages) | fichiers statiques |

```
Fidèles ──▶ nidaa.dj (Vercel) ──┐
Responsables ─▶ admin.nidaa.dj (Vercel) ──┤──▶ api.nidaa.dj (Render) ──▶ Supabase PostgreSQL
Écrans TV ──▶ ecran.nidaa.dj (Vercel) ──┘                         └──▶ Supabase Storage (photos)
```

> **État de ce guide.** Il a été écrit sans compte Supabase, Render ni Vercel : le code est testé en local
> (PostgreSQL local, stockage sur disque), mais **aucune étape ci-dessous n'a été exécutée sur les vrais services**.
> Les libellés des tableaux de bord changent souvent ; quand un nom de menu diffère, cherchez l'équivalent.
> Les points à vérifier en priorité lors du premier déploiement sont listés à la fin (« Points non vérifiés »).
> Aucun prix n'est indiqué ici : consultez les grilles tarifaires en vigueur de chaque service.

Durée à prévoir : une demi-journée. Il faut : le dépôt sur GitHub (ou GitLab), un ordinateur avec Node ≥ 22.12,
pnpm 10 et `psql`, et l'accès à la zone DNS du domaine. Les exemples utilisent `nidaa.dj` : remplacez par votre domaine.

---

## 1. Créer le projet Supabase

1. Créer un compte sur <https://supabase.com>, puis **New project**.
2. **Mot de passe de la base** : le générer, le noter dans un gestionnaire de mots de passe. Préférez un mot de passe
   sans caractères spéciaux (lettres et chiffres, 32 caractères) : il est inséré dans une URL.
3. **Région** : consultez la liste proposée au moment de la création. Deux critères, dans cet ordre :
   - la **même région que l'API** (ou la plus proche) : chaque requête de l'API fait plusieurs allers-retours avec la
     base, c'est cette distance-là qui compte le plus. `render.yaml` place l'API à Francfort ; si vous choisissez une
     autre région Supabase, changez `region` dans `render.yaml` en conséquence ;
   - la plus proche de Djibouti parmi celles offertes par les deux services. Mesurez plutôt que de deviner : depuis
     une connexion à Djibouti, comparez le temps de réponse de plusieurs régions (par exemple avec `ping` ou
     `curl -w '%{time_total}\n' -o /dev/null -s https://<hôte de la région>`), et retenez la plus rapide.
4. Une fois le projet prêt, récupérer **deux chaînes de connexion** : bouton **Connect** en haut du tableau de bord
   (ou *Project Settings → Database*). Le libellé exact peut différer selon la version du tableau de bord.

   | Variable | Chaîne à copier | Reconnaissable à |
   | --- | --- | --- |
   | `DATABASE_URL` | *Transaction pooler* | port **6543**, hôte `…pooler.supabase.com` |
   | `DIRECT_URL` | *Session pooler* | port **5432**, hôte `…pooler.supabase.com` |

   Dans les deux, remplacer `[YOUR-PASSWORD]` par le mot de passe. Ajouter `?pgbouncer=true` à la fin de
   `DATABASE_URL` :

   ```
   DATABASE_URL=postgresql://postgres.<ref>:<mot-de-passe>@<hôte>.pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.<ref>:<mot-de-passe>@<hôte>.pooler.supabase.com:5432/postgres
   ```

   - `DATABASE_URL` sert à l'API en fonctionnement. Le mode « transaction » partage peu de connexions entre beaucoup
     de requêtes ; l'API y est adaptée (pas de requêtes préparées nommées, pas d'état de session — voir
     `apps/api/src/prisma/pg-config.ts`).
   - `DIRECT_URL` sert aux **migrations**, qui ont besoin d'une vraie session. La chaîne *Direct connection*
     (`db.<ref>.supabase.co`) convient aussi, mais elle n'est en général joignable qu'en IPv6 : si votre réseau ou
     votre hébergeur n'a pas d'IPv6, utilisez le *Session pooler*.
5. **Certificat de la base (TLS).** L'API chiffre la connexion et vérifie le certificat du serveur. Supabase signe ses
   certificats avec sa propre autorité : la télécharger dans *Project Settings → Database → SSL Configuration*
   (fichier `.crt`). Son contenu ira dans la variable `DB_SSL_CA` à l'étape 5. À défaut, `DB_SSL_NO_VERIFY=true`
   garde le chiffrement mais ne vérifie plus l'identité du serveur — acceptable pour un premier essai, à corriger ensuite.

## 2. Créer les tables et les premières données (depuis votre ordinateur)

```bash
git clone <URL-du-dépôt> nidaa && cd nidaa
pnpm install
pnpm --filter @nidaa/shared build && pnpm --filter @nidaa/prayer-engine build
pnpm --filter @nidaa/api prisma:generate

# Dans ce terminal uniquement (ne pas écrire ces valeurs dans un fichier versionné) :
export DATABASE_URL='postgresql://postgres.<ref>:<mot-de-passe>@<hôte>.pooler.supabase.com:6543/postgres?pgbouncer=true'
export DIRECT_URL='postgresql://postgres.<ref>:<mot-de-passe>@<hôte>.pooler.supabase.com:5432/postgres'
export DB_SSL_CA_FILE="$HOME/Téléchargements/prod-ca-2021.crt"   # le certificat téléchargé à l'étape 1.5
# (ou, à défaut : export DB_SSL_NO_VERIFY=true)

# 1. Tables
pnpm --filter @nidaa/api prisma:deploy
```

Si `prisma:deploy` échoue parce que le moteur Prisma ne peut pas être téléchargé (`binaries.prisma.sh` bloqué), le
repli applique les mêmes fichiers SQL avec `psql` :

```bash
bash apps/api/scripts/apply-migrations.sh        # utilise DIRECT_URL
```

Puis les données de départ — **ne jamais lancer `prisma:seed`** ici (il crée des comptes de démonstration au mot de
passe public) :

```bash
# 2. Bibliothèque de contenus des écrans (hadiths, versets, invocations) — aucun compte
pnpm --filter @nidaa/api prisma:seed-content

# 3. Premier super-administrateur (12 caractères minimum, saisi sans écho)
read -rs -p "Mot de passe super-admin : " SUPER_ADMIN_PASSWORD && export SUPER_ADMIN_PASSWORD
pnpm --filter @nidaa/api prisma:create-admin -- --email vous@exemple.dj --name "Prénom Nom"
unset SUPER_ADMIN_PASSWORD
```

Vérification : dans Supabase → *Table Editor*, les tables `Mosque`, `User`, `ContentItem`… existent ; `User` contient
votre compte, `ContentItem` quelques dizaines de lignes.

## 3. Verrouiller l'API REST automatique de Supabase (RLS)

Supabase publie d'office le schéma `public` par une API REST accessible avec la clé « anon », qui est publique. Nidaa
ne s'en sert pas : son API se connecte directement à PostgreSQL. Il faut donc fermer cette porte.

Supabase → **SQL Editor** → coller le contenu de [`enable-rls.sql`](./enable-rls.sql) → **Run**.

Le script active la sécurité au niveau des lignes (RLS) sur toutes les tables, **sans créer de politique** : les rôles
de l'API REST (`anon`, `authenticated`) ne voient alors plus aucune ligne. L'API Nidaa, elle, se connecte avec le rôle
propriétaire des tables, que la RLS ne restreint pas : rien ne change pour elle. La dernière requête du script liste
les tables restées sans RLS : elle doit être vide.

**À refaire après chaque mise à jour qui ajoute une table** (les nouvelles tables naissent sans RLS). L'onglet
*Advisors / Security* de Supabase signale les tables oubliées.

## 4. Créer l'espace de stockage des photos

1. Supabase → **Storage** → **New bucket** → nom **`nidaa-media`**, cocher **Public bucket**.
   « Public » signifie : *lecture* libre par URL (c'est voulu, les photos s'affichent sur le site public).
   L'envoi et la suppression restent réservés à l'API, qui utilise la clé de service.
   Si l'écran le propose, limiter la taille des fichiers à 5 Mo et les types à `image/jpeg, image/png, image/webp`
   (l'API applique déjà ces règles ; c'est une seconde barrière).
2. Ne créer **aucune politique** sur ce compartiment.
3. Récupérer, dans *Project Settings → API* (ou *API Keys*) :
   - **Project URL** → variable `SUPABASE_URL` (`https://<ref>.supabase.co`) ;
   - la clé **`service_role`** (ou « secret key » dans les tableaux de bord récents) → `SUPABASE_SERVICE_ROLE_KEY`.

> **La clé de service donne tous les droits sur la base et le stockage.** Elle ne va que dans les variables
> d'environnement de l'API sur Render. Jamais dans Vercel, jamais dans une variable `NEXT_PUBLIC_*` ou `VITE_*`
> (ces variables sont copiées dans le JavaScript envoyé aux navigateurs), jamais dans le dépôt. En cas de fuite :
> la régénérer dans Supabase, puis la remplacer sur Render.

Les photos sont enregistrées sous `mosques/<identifiant de la mosquée>/<uuid>.<ext>` et servies à l'adresse
`https://<ref>.supabase.co/storage/v1/object/public/nidaa-media/mosques/…`.

## 5. Déployer l'API sur Render

1. Créer un compte sur <https://render.com> et y connecter le dépôt Git.
2. **New → Blueprint**, choisir le dépôt : Render lit [`render.yaml`](../../render.yaml) à la racine et propose le
   service `nidaa-api` (Docker, `apps/api/Dockerfile`, contrôle de santé `/v1/time`).
3. Render demande les valeurs marquées « à saisir » :

   | Variable | Valeur |
   | --- | --- |
   | `DATABASE_URL` | chaîne *Transaction pooler* (port 6543) + `?pgbouncer=true` |
   | `DIRECT_URL` | chaîne *Session pooler* (port 5432) |
   | `DB_SSL_CA` | contenu complet du certificat `.crt` de l'étape 1.5 (de `-----BEGIN CERTIFICATE-----` à `-----END CERTIFICATE-----`) |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé de service (étape 4) |
   | `CORS_ORIGINS` | `https://admin.nidaa.dj,https://ecran.nidaa.dj` |
   | `PUBLIC_API_URL` | `https://api.nidaa.dj` |

   Les autres sont préremplies par `render.yaml` : `STORAGE_DRIVER=supabase`, `STORAGE_BUCKET=nidaa-media`,
   `DB_POOL_MAX=5`, `MIGRATE_MODE=prisma`, `SWAGGER_ENABLED=false`, et deux secrets générés par Render
   (`JWT_SECRET`, `INTERNAL_API_TOKEN`). Notez la valeur d'`INTERNAL_API_TOKEN` (onglet *Environment*) : le site
   public en a besoin à l'étape 6.
4. Lancer le déploiement. Au démarrage, le conteneur applique les migrations (`prisma migrate deploy`, par
   `DIRECT_URL`) puis lance l'API. Dans les journaux, on doit lire `Stockage des médias : pilote « supabase »` puis
   `Nidaa API prête`.
5. Vérifier : `curl https://<nom>.onrender.com/v1/time` répond `{"now":"…"}`.

**`CORS_ORIGINS` doit contenir exactement les origines de production du back-office et de l'écran** (schéma `https://`,
sans barre finale, séparées par une virgule). S'il manque une origine, le navigateur refuse les appels : le
back-office affiche « Impossible de joindre le serveur », l'écran ne peut plus s'appairer. Tant que les domaines
définitifs ne sont pas en place, ajoutez-y les adresses `https://….vercel.app`. Le site public n'a pas besoin d'y
figurer : les routes publiques en lecture sont ouvertes à toute origine.

**Instance toujours allumée, une seule instance.** L'offre choisie dans `render.yaml` ne s'endort pas : c'est
nécessaire, car les écrans gardent une connexion ouverte en permanence pour recevoir les modifications (SSE), et un
réveil à froid ferait attendre chaque appairage. Ne passez pas à plusieurs instances sans ajouter Redis (`REDIS_URL`).

**Ne pas utiliser `STORAGE_DRIVER=local` ici** : le disque d'un conteneur Render est effacé à chaque déploiement.

<details><summary>Autres hébergeurs de conteneurs : Railway, Fly.io</summary>

Le même `apps/api/Dockerfile` convient (contexte de construction = racine du dépôt) avec les mêmes variables.

- **Railway** : nouveau service depuis le dépôt, *Dockerfile path* = `apps/api/Dockerfile`, *Root directory* laissé à
  la racine, contrôle de santé `/v1/time`. Désactiver la mise en veille du service (« serverless / app sleeping »).
- **Fly.io** : `fly launch --dockerfile apps/api/Dockerfile --no-deploy` depuis la racine ; dans `fly.toml`,
  `internal_port = 4000`, `auto_stop_machines = "off"`, `min_machines_running = 1`, un contrôle HTTP sur `/v1/time` ;
  secrets par `fly secrets set`. Fly achemine l'IPv6 : la chaîne *Direct connection* de Supabase y est utilisable.

Ces deux variantes n'ont pas été essayées.
</details>

## 6. Déployer le back-office, le site public et l'écran sur Vercel

Créer **trois projets Vercel** à partir du même dépôt (*Add New → Project*, importer le dépôt trois fois). Pour chacun :

| Réglage | Back-office | Site public | Écran |
| --- | --- | --- | --- |
| **Root Directory** | `apps/admin` | `apps/web` | `apps/screen` |
| Framework | Next.js | Next.js | Vite |
| Node.js | 22.x | 22.x | 22.x |

Laisser activée l'option qui inclut les fichiers hors du dossier racine (« Include files outside the Root
Directory ») : les applications dépendent de `packages/`. Les commandes sont déjà dans le `vercel.json` de chaque
application, il n'y a rien à saisir :

- installation : `pnpm install --frozen-lockfile --filter "@nidaa/<app>..."` (l'application et ses paquets du dépôt) ;
- construction : `cd ../.. && pnpm turbo run build --filter=@nidaa/<app>` (construit d'abord `packages/shared` et
  `packages/prayer-engine`, puis l'application) ;
- écran : sortie `dist`, repli vers `index.html`, et en-têtes de cache — `index.html`, `sw.js` et le manifeste sont
  revalidés à chaque visite (c'est ce qui permet aux écrans de prendre une nouvelle version), `/assets/*` est mis en
  cache un an.

Variables d'environnement (*Settings → Environment Variables*, environnement *Production*) :

| Projet | Variable | Valeur |
| --- | --- | --- |
| Back-office | `NEXT_PUBLIC_API_URL` | `https://api.nidaa.dj` |
| Back-office | `NEXT_PUBLIC_SCREEN_URL` | `https://ecran.nidaa.dj` |
| Site public | `NEXT_PUBLIC_API_URL` | `https://api.nidaa.dj` |
| Site public | `API_URL` | `https://api.nidaa.dj` |
| Site public | `NEXT_PUBLIC_SITE_URL` | `https://nidaa.dj` |
| Site public | `INTERNAL_API_TOKEN` | la valeur générée par Render (étape 5) — cocher « Sensitive » |
| Écran | `VITE_API_URL` | `https://api.nidaa.dj` |

`INTERNAL_API_TOKEN` n'est lu que par le serveur du site (il l'exempte de la limite de débit de l'API) ; ne pas le
préfixer par `NEXT_PUBLIC_`. Aucune clé Supabase ne va sur Vercel.

L'option `output: "standalone"` de Next.js ne sert qu'aux images Docker : elle n'est activée que si
`NEXT_OUTPUT=standalone` (défini dans les Dockerfile). Ne pas définir cette variable sur Vercel.

**Écran sur Cloudflare Pages (variante).** Commande de construction
`pnpm install --frozen-lockfile && pnpm turbo run build --filter=@nidaa/screen`, dossier de sortie
`apps/screen/dist`, variable `VITE_API_URL`, `NODE_VERSION=22`. Le repli vers `index.html` est automatique pour une
application à page unique ; les en-têtes de cache se déclarent dans un fichier `_headers` (non fourni).

## 7. Domaines et DNS

| Nom | Chez | Enregistrement DNS |
| --- | --- | --- |
| `api.nidaa.dj` | Render → service → *Settings → Custom Domains* | `CNAME` vers l'adresse `….onrender.com` indiquée |
| `admin.nidaa.dj` | Vercel → projet back-office → *Settings → Domains* | `CNAME` vers la cible indiquée par Vercel |
| `ecran.nidaa.dj` | Vercel → projet écran → *Domains* | `CNAME` vers la cible indiquée par Vercel |
| `nidaa.dj` (racine) | Vercel → projet site public → *Domains* | enregistrement `A` vers l'adresse indiquée par Vercel (une racine ne peut pas porter de `CNAME`) |
| `www.nidaa.dj` | Vercel → projet site public | `CNAME`, avec redirection vers `nidaa.dj` |

Recopiez les valeurs affichées par chaque tableau de bord plutôt que celles d'un tutoriel : elles changent. Les
certificats HTTPS sont émis automatiquement dès que le DNS répond (de quelques minutes à quelques heures).

## 8. Fixer les URL publiques et reconstruire

Les variables `NEXT_PUBLIC_*` et `VITE_*` sont **figées dans le JavaScript à la construction**. Après avoir branché
les domaines :

1. vérifier les valeurs du tableau de l'étape 6 dans chacun des trois projets Vercel ;
2. **redéployer** chaque projet (*Deployments → … → Redeploy*) — modifier une variable ne suffit pas ;
3. sur Render, mettre `CORS_ORIGINS` et `PUBLIC_API_URL` aux valeurs définitives (le service redémarre seul).

## 9. Contrôles après mise en ligne

- [ ] `curl https://api.nidaa.dj/v1/time` → `{"now":"…"}` ; l'heure est exacte.
- [ ] `curl -i https://api.nidaa.dj/docs` → 404 (Swagger désactivé).
- [ ] `https://admin.nidaa.dj` : connexion avec le compte super-admin de l'étape 2.
- [ ] Créer une mosquée de test, la soumettre, la valider depuis l'espace super-admin.
- [ ] `https://ecran.nidaa.dj` sur une TV ou un navigateur : un code à 6 caractères s'affiche ; le saisir dans
      **Écrans → Associer un écran** ; l'écran bascule sur les horaires en quelques secondes.
- [ ] Modifier une iqama dans le back-office : l'écran se met à jour en moins d'une minute sans rechargement.
- [ ] **Fiche mosquée → Photos** : envoyer une photo ; elle apparaît en vignette, puis sur `https://nidaa.dj/m/<slug>`.
      Son adresse commence par `https://<ref>.supabase.co/storage/v1/object/public/nidaa-media/`.
- [ ] Supprimer la photo : elle disparaît aussi de Supabase → Storage → `nidaa-media`.
- [ ] Tenter d'envoyer un PDF renommé en `.jpg` : refus avec le message « Format non accepté ».
- [ ] `curl "https://<ref>.supabase.co/rest/v1/User?select=email" -H "apikey: <clé anon>"` → liste **vide** `[]`
      (ou erreur d'autorisation) : la RLS protège bien les tables.
- [ ] Redéployer l'API sur Render, puis vérifier que la photo envoyée est toujours visible (elle est chez Supabase,
      pas sur le disque du conteneur).

## 10. Sauvegardes

- **Sauvegardes de Supabase** : selon l'offre, Supabase conserve des sauvegardes quotidiennes de la base pendant une
  durée limitée ; vérifiez dans *Database → Backups* ce qui est réellement inclus dans votre offre et comment
  restaurer. Ne comptez pas dessus sans l'avoir vérifié.
- **Sauvegarde manuelle de la base**, à conserver ailleurs (à faire avant chaque mise à jour, et chaque semaine) :

  ```bash
  pg_dump "$DIRECT_URL" --schema=public --no-owner --no-privileges --clean --if-exists \
    | gzip > nidaa-$(date +%Y%m%d-%H%M%S).sql.gz
  ```

  Utilisez un `pg_dump` de version égale ou supérieure à celle du PostgreSQL de Supabase (indiquée dans
  *Project Settings → Infrastructure*). Restauration : `gunzip -c fichier.sql.gz | psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction`,
  puis relancer `enable-rls.sql`. Faites un essai de restauration sur un projet Supabase vide avant d'en avoir besoin.
- **Photos** : les sauvegardes de la base ne contiennent pas les fichiers du stockage, seulement leurs adresses.
  Copiez périodiquement le compartiment `nidaa-media` (téléchargement depuis le tableau de bord, ou outil compatible
  S3 avec les clés d'accès S3 de Supabase Storage).
- **Secrets** : conservez `JWT_SECRET`, `INTERNAL_API_TOKEN`, le mot de passe de la base et la clé de service dans un
  gestionnaire de mots de passe. Changer `JWT_SECRET` déconnecte tous les utilisateurs et invalide les appairages en cours.

## 11. Limites à surveiller

- **Mise en pause de l'offre gratuite de Supabase.** Un projet gratuit peut être mis en pause après une période
  d'inactivité, et la base devient alors injoignable jusqu'à sa réactivation manuelle — **vérifiez les conditions
  actuelles de l'offre gratuite**. Pour un service utilisé par de vraies mosquées, prévoyez une offre payante.
- **Nombre de connexions à la base.** L'API ouvre au plus `DB_POOL_MAX` connexions (5) vers le pooler. Le pooler et la
  base ont eux-mêmes un plafond qui dépend de l'offre (*Database → Connection pooling*). Les scripts lancés depuis un
  ordinateur comptent aussi. En cas d'erreurs « too many connections » ou « max clients reached » : ne pas augmenter
  `DB_POOL_MAX` à l'aveugle, vérifier d'abord qu'une seule instance de l'API tourne.
- **Volume et trafic du stockage.** Chaque affichage d'une photo est un téléchargement depuis Supabase Storage, compté
  dans le quota de trafic sortant de l'offre. Les photos sont limitées à 5 Mo et 12 par mosquée, et servies avec un
  cache d'un an, mais elles ne sont ni redimensionnées ni compressées : demandez aux mosquées des images de
  1600 pixels de large au plus. Surveillez *Reports / Usage*.
- **Images d'annonces.** Une image envoyée pour une annonce reste dans le stockage après la suppression de l'annonce
  (plafond : 60 par mosquée). Un nettoyage périodique reste à écrire.
- **Limite de débit par adresse IP.** L'API compte les requêtes publiques par adresse IP en se fiant au dernier proxy
  (`TRUST_PROXY=1`). Derrière Render, vérifiez dans les journaux que les adresses relevées sont bien celles des
  visiteurs ; sinon, ajustez `TRUST_PROXY` au nombre de proxys traversés.
- **Purge du cache du site public.** Le site garde les pages 60 secondes et les purge à chaque modification ; sur
  Vercel, le frein anti-abus de cette purge est en mémoire de chaque fonction, donc approximatif.
- **Écrans hors ligne.** Les horaires restent affichés sans réseau (cache de 30 jours) ; les images d'annonces, elles,
  ne sont pas garanties hors ligne.

### Quand passer au kit VM

Le dossier [`deploy/`](../README.md) installe tout sur une seule machine virtuelle. Y passer quand : la facture
cumulée des trois services dépasse celle d'une VM ; vous voulez héberger les données à Djibouti ou chez un hébergeur
précis ; la latence entre l'API et la base devient gênante ; ou les plafonds de connexions et de trafic sont atteints.
La migration se fait par `pg_dump` / `psql` (étape 10) et une copie des photos ; les adresses des photos enregistrées
en base pointent vers Supabase et devront être réécrites si le stockage change.

## Supabase + hébergeurs managés, ou VM unique ?

| | Supabase + Render + Vercel (ce guide) | VM unique ([`deploy/README.md`](../README.md)) |
| --- | --- | --- |
| Administration | aucune machine à maintenir ; certificats, mises à jour système et redémarrages gérés par les hébergeurs | à votre charge : mises à jour de sécurité, pare-feu, surveillance du disque |
| Mise à jour de Nidaa | un `git push` redéploie tout | `git pull` puis `docker compose build` et `up -d` sur le serveur |
| Sauvegardes | celles de Supabase selon l'offre, plus `pg_dump` manuel | `backup.sh` chaque nuit, à copier hors du serveur |
| Photos | Supabase Storage | volume Docker de la VM (`STORAGE_DRIVER=local`), ou Supabase Storage |
| Temps réel entre instances | mémoire du processus : une seule instance d'API (Redis à ajouter au-delà) | Redis inclus |
| Coût | quatre abonnements qui évoluent avec l'usage ; des offres gratuites existent mais avec mise en veille | un abonnement fixe |
| Localisation des données | régions proposées par les fournisseurs | où vous voulez, y compris à Djibouti |
| Dépendances | quatre fournisseurs, quatre tableaux de bord, quatre comptes à sécuriser | un seul serveur — donc un seul point de panne |
| Latence | API et base dans la même région ; fidèles servis par le réseau de Vercel | tout au même endroit ; dépend de la distance entre la VM et les fidèles |

En résumé : **ce guide pour démarrer vite un pilote sans compétence serveur** ; **la VM pour maîtriser le coût,
l'emplacement des données et tout garder au même endroit** une fois le service installé. Le code est le même dans les
deux cas : seules les variables d'environnement changent. Dans les deux cas, les écrans déjà installés continuent
d'afficher leurs horaires si la plateforme est momentanément indisponible.

## Points non vérifiés

Rien de ce qui suit n'a pu être essayé faute de comptes ; à contrôler lors du premier déploiement :

1. Connexion de l'API au pooler Supabase en mode transaction (port 6543) et vérification TLS avec `DB_SSL_CA`.
2. `prisma migrate deploy` par `DIRECT_URL` (pooler en mode session), au démarrage du conteneur sur Render.
3. Envoi et suppression réels dans Supabase Storage (les requêtes sont vérifiées par un test avec un client HTTP
   simulé, d'après la documentation de l'API REST de Storage) et format de la clé de service des projets récents.
4. Interprétation de `render.yaml` par Render (noms d'offre et de région, construction Docker avec BuildKit).
5. Construction des trois projets sur Vercel avec les `vercel.json` fournis (commandes pnpm/turbo, en-têtes et
   repli de l'écran, comportement du service worker).
6. Le script `enable-rls.sql` a été exécuté sur un PostgreSQL 16 local (un rôle sans droit de propriété ne voit plus
   aucune ligne, le propriétaire voit tout), pas dans l'éditeur SQL de Supabase.
