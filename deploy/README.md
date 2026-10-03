# Déployer Nidaa — pilote sur un seul serveur

> Autre option, sans serveur à administrer : Supabase (base et photos) + Render (API) + Vercel (back-office, site,
> écran) — voir [`supabase/README.md`](./supabase/README.md), qui compare aussi les deux approches.

Ce dossier met en production toute la plateforme sur **une VM Linux avec Docker** : PostgreSQL, Redis, l'API,
le back-office, le site public, l'écran TV et un reverse proxy Caddy qui obtient et renouvelle seul les
certificats HTTPS.

| Fichier | Rôle |
| --- | --- |
| `docker-compose.prod.yml` | La pile complète (7 services) |
| `Caddyfile` | Reverse proxy HTTPS : 4 noms de domaine, compression, en-têtes de sécurité, SSE |
| `.env.prod.example` | Toutes les variables ; à copier en `.env` |
| `backup.sh` | Sauvegarde PostgreSQL datée, conservation 14 jours |

Les images sont construites sur le serveur à partir du dépôt (`apps/*/Dockerfile`, contexte = racine du dépôt).

```
Internet ──80/443──▶ caddy ─┬─ api.nidaa.dj    ─▶ api:4000    ─▶ postgres, redis
                            ├─ admin.nidaa.dj  ─▶ admin:3000
                            ├─ nidaa.dj (+www) ─▶ web:3001    ─▶ api:4000 (réseau interne)
                            └─ ecran.nidaa.dj  ─▶ screen:8080 (fichiers statiques)
```

## 1. Serveur

- **Taille pour le pilote : 2 vCPU, 4 Go de RAM, 40 Go de disque SSD.** Ubuntu 24.04 LTS ou Debian 12.
  La construction des images Next.js est l'opération la plus gourmande (environ 2 Go de RAM) ; avec moins de 4 Go,
  ajouter 2 Go de swap.
- Docker Engine et le plugin Compose : <https://docs.docker.com/engine/install/>.
- Horloge synchronisée (NTP actif : `timedatectl` doit afficher `System clock synchronized: yes`). Les écrans
  mesurent leur dérive par rapport à l'heure du serveur : une horloge serveur fausse fausse tous les écrans.

## 2. DNS

Cinq enregistrements **A** (et **AAAA** si la VM a une IPv6) vers l'adresse publique de la VM :

| Nom | Sert |
| --- | --- |
| `nidaa.dj` | site public |
| `www.nidaa.dj` | redirigé vers `nidaa.dj` |
| `api.nidaa.dj` | API |
| `admin.nidaa.dj` | back-office |
| `ecran.nidaa.dj` | écran TV |

Les enregistrements doivent être en place **avant** le premier démarrage : Caddy demande les certificats
dès son lancement, et Let's Encrypt limite le nombre d'échecs par heure.

## 3. Pare-feu

Ouvrir uniquement **80/tcp**, **443/tcp** (et **443/udp** pour HTTP/3), plus SSH restreint à vos adresses.
PostgreSQL et Redis ne publient aucun port : ils ne sont joignables que depuis le réseau interne de la pile.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw enable
```

Attention : Docker publie ses ports en contournant `ufw`. Ce n'est pas un problème ici (seul Caddy publie des
ports), mais ne jamais ajouter de `ports:` à `postgres` ou `redis`.

## 4. Premier démarrage

```bash
sudo mkdir -p /opt/nidaa && sudo chown "$USER" /opt/nidaa
git clone <URL-du-dépôt> /opt/nidaa
cd /opt/nidaa/deploy

cp .env.prod.example .env && chmod 600 .env
# Renseigner les 4 domaines et ACME_EMAIL, puis générer les 3 secrets :
for v in POSTGRES_PASSWORD JWT_SECRET INTERNAL_API_TOKEN; do sed -i "s|^$v=.*|$v=$(openssl rand -hex 32)|" .env; done

docker compose -f docker-compose.prod.yml config --quiet     # vérifie le fichier .env
docker compose -f docker-compose.prod.yml up -d --build      # 5 à 10 minutes la première fois
docker compose -f docker-compose.prod.yml ps                 # tout doit être « running » / « healthy »
```

Au démarrage, le conteneur `api` applique les migrations (`prisma migrate deploy`) puis lance le serveur.
Vérification : `curl https://api.nidaa.dj/v1/time` doit répondre `{"now":"…"}`.

`POSTGRES_PASSWORD` n'est pris en compte qu'à la **création** du volume de la base. Pour le changer ensuite :
`ALTER USER nidaa PASSWORD '…'` dans psql, puis mettre `.env` à jour et relancer `api`.

### Initialiser les données

Ne **pas** lancer `prisma:seed` en production : il crée des comptes de démonstration au mot de passe public.
Deux scripts dédiés :

```bash
# 1. Bibliothèque de contenus (hadiths, versets, invocations des écrans) — aucun compte, aucune mosquée
docker compose -f docker-compose.prod.yml exec api node_modules/.bin/tsx prisma/seed-content.ts

# 2. Premier super-administrateur (mot de passe de 12 caractères minimum, saisi sans écho ni historique)
read -rs -p "Mot de passe super-admin : " SUPER_ADMIN_PASSWORD && export SUPER_ADMIN_PASSWORD
docker compose -f docker-compose.prod.yml exec -e SUPER_ADMIN_PASSWORD api \
  node_modules/.bin/tsx prisma/create-super-admin.ts --email vous@exemple.dj --name "Prénom Nom"
unset SUPER_ADMIN_PASSWORD
```

Les deux scripts sont relançables sans risque. `create-super-admin.ts` promeut un compte existant sans toucher
à son mot de passe ; ajouter `--reset-password` pour le remplacer. Hors Docker, les mêmes scripts s'appellent
`pnpm --filter @nidaa/api prisma:seed-content` et `pnpm --filter @nidaa/api prisma:create-admin -- --email …`.

Ensuite : se connecter sur `https://admin.nidaa.dj`. Les responsables de mosquée s'inscrivent eux-mêmes,
créent leur fiche et la soumettent ; le super-admin la valide. Un écran s'installe en ouvrant
`https://ecran.nidaa.dj` sur la TV puis en saisissant son code dans **Écrans → Associer un écran**.

### Si `prisma migrate deploy` ne peut pas s'exécuter

Le client Prisma de l'API n'utilise aucun binaire natif (adaptateur `pg`, moteur WASM). Seules les **migrations**
ont besoin du binaire `schema-engine`, téléchargé depuis `binaries.prisma.sh` pendant la construction de l'image.
Si ce téléchargement est bloqué par le réseau, utiliser le repli `apps/api/scripts/apply-migrations.sh`, qui
applique les mêmes fichiers SQL avec `psql` et tient la même table `_prisma_migrations` (présent dans l'image,
avec `psql`). Dans `.env` :

```
MIGRATE_MODE=psql
PRISMA_OFFLINE=1
```

puis `docker compose -f docker-compose.prod.yml up -d --build api`. Application manuelle ponctuelle :

```bash
docker compose -f docker-compose.prod.yml run --rm -e MIGRATE_MODE=none api bash scripts/apply-migrations.sh
```

## 5. Sauvegardes

`backup.sh` écrit `nidaa-AAAAMMJJ-HHMMSS.sql.gz` dans `BACKUP_DIR` (par défaut `/var/backups/nidaa`), vérifie
l'archive et supprime celles de plus de 14 jours (`BACKUP_KEEP_DAYS`).

```bash
sudo mkdir -p /var/backups/nidaa && sudo chown "$USER" /var/backups/nidaa
/opt/nidaa/deploy/backup.sh                      # essai manuel
crontab -e                                        # puis ajouter :
30 2 * * * /opt/nidaa/deploy/backup.sh >> /var/log/nidaa-backup.log 2>&1
```

(Le fichier journal doit être accessible en écriture à cet utilisateur : `sudo touch /var/log/nidaa-backup.log && sudo chown "$USER" /var/log/nidaa-backup.log`.)

**Photos.** Avec `STORAGE_DRIVER=local` (défaut), les photos sont dans le volume Docker `api_media`, que `backup.sh`
ne sauvegarde pas. Les archiver à part, par exemple :
`docker run --rm -v nidaa_api_media:/m:ro -v /var/backups/nidaa:/b alpine tar czf /b/media-$(date +%Y%m%d).tar.gz -C /m .`

Une sauvegarde qui reste sur la même VM ne protège pas de la perte de la VM : **copier chaque nuit le dossier
hors du serveur** (rsync vers une autre machine, stockage objet…). Sauvegarder aussi `deploy/.env` en lieu sûr :
sans `JWT_SECRET`, toutes les sessions sont invalidées.

### Restaurer

```bash
cd /opt/nidaa/deploy
docker compose -f docker-compose.prod.yml stop api admin web
gunzip -c /var/backups/nidaa/nidaa-AAAAMMJJ-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U nidaa -d nidaa -v ON_ERROR_STOP=1 --single-transaction
docker compose -f docker-compose.prod.yml up -d
```

La sauvegarde contient les `DROP … IF EXISTS` nécessaires : elle remplace le contenu de la base existante.
`--single-transaction` garantit qu'une restauration qui échoue ne laisse pas la base à moitié remplacée.
Faire un essai de restauration sur une autre machine avant d'en avoir besoin.

## 6. Mise à jour

```bash
cd /opt/nidaa
./deploy/backup.sh                                             # toujours avant une mise à jour
git pull
cd deploy
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d                # les migrations s'appliquent au démarrage de l'API
docker image prune -f
```

L'interruption dure quelques secondes. Les écrans continuent d'afficher les horaires pendant ce temps (cache
local de 30 jours) et se resynchronisent seuls. Après modification d'un domaine ou d'une variable `NEXT_PUBLIC_*`
dans `.env`, reconstruire (`build`) : ces valeurs sont figées dans les applications à la compilation.

Retour arrière : `git checkout <commit précédent>` puis les mêmes commandes `build` et `up -d`. Si la version
abandonnée avait appliqué une migration, restaurer aussi la sauvegarde prise avant la mise à jour.

## 7. Journaux et diagnostic

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 api      # ou caddy, web, admin, screen, postgres
docker stats --no-stream
df -h /var/lib/docker
```

Les journaux sont limités à 5 fichiers de 10 Mo par service.

| Symptôme | Piste |
| --- | --- |
| Certificat non obtenu | `logs caddy` ; DNS pas encore propagé ou port 80 fermé |
| Le back-office affiche une erreur réseau | `CORS_ORIGINS` ne contient pas `https://<DOMAIN_ADMIN>` exactement |
| `api` redémarre en boucle | `logs api` : migration en échec, ou mot de passe PostgreSQL changé après la création du volume |
| Les écrans ne se mettent plus à jour en direct | `logs caddy` et `logs redis` ; l'écran se rabat sur une interrogation toutes les 60 s |
| Réponses 429 sur l'API publique | limite de 120 requêtes/min par IP (`PUBLIC_RATE_LIMIT`) |

## 8. Liste de contrôle sécurité

- [ ] `POSTGRES_PASSWORD`, `JWT_SECRET` et `INTERNAL_API_TOKEN` générés aléatoirement — plus aucun « CHANGER » dans `.env` ; `chmod 600 .env`.
- [ ] `prisma:seed` jamais lancé en production ; aucun compte `admin@nidaa.dj` / `imam@al-rahma.dj` au mot de passe de démonstration.
- [ ] `SWAGGER_ENABLED=false` : `https://api.nidaa.dj/docs` répond 404. (Par défaut, Swagger est actif en développement et désactivé quand `NODE_ENV=production`.)
- [ ] `CORS_ORIGINS` limité au back-office et à l'écran. Les routes publiques en lecture (`/v1/mosques*`, `/v1/time`) sont volontairement ouvertes à toute origine, sans identifiants, et limitées en débit.
- [ ] Pare-feu : seuls 80, 443 et SSH. SSH par clé, connexion root par mot de passe désactivée.
- [ ] Sauvegarde nocturne en place, copiée hors du serveur, restauration testée une fois.
- [ ] Mises à jour de sécurité automatiques du système (`unattended-upgrades`).
- [ ] Mot de passe du super-admin unique et long. La double authentification n'existe pas encore dans l'application.

## Limites connues de ce kit

- Un seul serveur : aucune redondance. Une panne de la VM interrompt le back-office et le site ; les écrans déjà
  installés continuent d'afficher les horaires grâce à leur cache.
- Les photos sont stockées sur le disque de la VM (volume `api_media`) et servies par l'API, sans redimensionnement
  ni CDN. Pour les sortir de la VM : `STORAGE_DRIVER=supabase` (voir `supabase/README.md`).
- Le limiteur de débit et la limitation de purge du site public sont en mémoire, par processus : adaptés à une
  instance de chaque service, à revoir avant de multiplier les instances.
