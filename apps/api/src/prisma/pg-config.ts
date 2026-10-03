import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

/**
 * Configuration du pool `pg` utilisé par l'adaptateur Prisma — compatible avec un pooler en mode transaction
 * (Supabase/Supavisor port 6543, PgBouncer) :
 * - le pilote `pg` n'émet que des requêtes préparées **anonymes** (protocole étendu sans nom de statement), les
 *   seules admises en mode transaction ; l'adaptateur Prisma ne nomme aucun statement ;
 * - aucune dépendance à l'état de session (pas de LISTEN/NOTIFY, pas de SET de session, pas de verrou consultatif) :
 *   les événements temps réel passent par Redis ou la mémoire du processus ;
 * - `max` petit (DB_POOL_MAX, défaut 5) : c'est le pooler qui multiplexe, inutile d'ouvrir beaucoup de connexions.
 *
 * TLS : activé dès que l'hôte n'est pas local (localhost, 127.0.0.1, ::1, ou nom sans point comme le service
 * Docker « postgres »). `sslmode=disable` dans l'URL ou DB_SSL=false le désactive, DB_SSL=true le force.
 * Le certificat est vérifié par défaut ; DB_SSL_CA / DB_SSL_CA_FILE fournissent l'autorité (Supabase signe avec
 * sa propre AC, téléchargeable dans le tableau de bord) ; DB_SSL_NO_VERIFY=true chiffre sans vérifier.
 */
type Env = Record<string, string | undefined>;

/** Paramètres d'URL propres à Prisma ou à libpq que le pilote `pg` ne doit pas interpréter lui-même. */
const STRIPPED_PARAMS = ["pgbouncer", "connection_limit", "pool_timeout", "connect_timeout", "sslmode", "sslcert", "sslkey", "sslrootcert", "schema"];

export function isLocalDbHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "" || h === "localhost" || h === "127.0.0.1" || h === "::1" || h.startsWith("/") || !h.includes(".") && !h.includes(":");
}

const truthy = (v: string | undefined) => v != null && ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
const falsy = (v: string | undefined) => v != null && ["0", "false", "no", "off"].includes(v.trim().toLowerCase());

export function pgPoolConfig(env: Env = process.env, readFile: (p: string) => string = (p) => readFileSync(p, "utf8")): PoolConfig {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL manquant");
  const url = new URL(raw);
  const sslmode = url.searchParams.get("sslmode");
  for (const p of STRIPPED_PARAMS) url.searchParams.delete(p);

  let useSsl = !isLocalDbHost(url.hostname);
  if (sslmode === "disable") useSsl = false;
  else if (sslmode && sslmode !== "allow" && sslmode !== "prefer") useSsl = true;
  if (truthy(env.DB_SSL)) useSsl = true;
  if (falsy(env.DB_SSL)) useSsl = false;

  let ssl: PoolConfig["ssl"] = false;
  if (useSsl) {
    if (truthy(env.DB_SSL_NO_VERIFY)) ssl = { rejectUnauthorized: false };
    else {
      const ca = env.DB_SSL_CA?.trim() ? env.DB_SSL_CA.replace(/\\n/g, "\n") : env.DB_SSL_CA_FILE?.trim() ? readFile(env.DB_SSL_CA_FILE.trim()) : undefined;
      ssl = ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
    }
  }

  const max = Number(env.DB_POOL_MAX ?? env.DATABASE_POOL_MAX ?? 5);
  return {
    connectionString: url.toString(),
    max: Number.isFinite(max) && max >= 1 ? Math.floor(max) : 5,
    ssl,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Derrière un pooler ou un NAT, une connexion inactive peut être coupée sans préavis.
    keepAlive: true,
  };
}
