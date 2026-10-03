import { type StorageDriver, assertSafeKey } from "./storage.types";

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: Uint8Array | string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Pilote Supabase Storage par son API REST, avec la clé « service role » (côté serveur uniquement).
 *
 * Choix REST plutôt que l'accès compatible S3 : deux appels HTTP suffisent (envoi, suppression), `fetch` est natif
 * dans Node 22 — donc aucune dépendance supplémentaire (le SDK AWS pèse plusieurs dizaines de Mo dans l'image) — et
 * un seul secret à gérer au lieu d'une paire de clés S3 en plus. Le compartiment est public en lecture : l'URL
 * publique est `${SUPABASE_URL}/storage/v1/object/public/<compartiment>/<clé>` ; l'écriture exige la clé de service.
 */
export class SupabaseStorageDriver implements StorageDriver {
  readonly name = "supabase" as const;
  private readonly base: string;
  private readonly bucket: string;
  private readonly key: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: { url: string; serviceRoleKey: string; bucket: string; fetchImpl?: FetchLike }) {
    if (!/^https?:\/\//.test(opts.url)) throw new Error("SUPABASE_URL invalide (attendu : https://<ref>.supabase.co)");
    if (!opts.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(opts.bucket)) throw new Error("STORAGE_BUCKET invalide");
    this.base = opts.url.replace(/\/+$/, "");
    this.bucket = opts.bucket;
    this.key = opts.serviceRoleKey;
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init as RequestInit));
  }

  private auth(): Record<string, string> {
    return { authorization: `Bearer ${this.key}`, apikey: this.key };
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    const res = await this.fetchImpl(`${this.base}/storage/v1/object/${this.bucket}/${assertSafeKey(key)}`, {
      method: "POST",
      // Les clés contiennent un UUID : le contenu d'une URL ne change jamais, d'où le cache d'un an.
      headers: { ...this.auth(), "content-type": contentType, "cache-control": "max-age=31536000", "x-upsert": "true" },
      body: new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Supabase Storage : envoi refusé (${res.status}) ${(await res.text().catch(() => "")).slice(0, 300)}`);
    return this.publicUrl(key);
  }

  async remove(key: string): Promise<void> {
    const res = await this.fetchImpl(`${this.base}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: { ...this.auth(), "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [assertSafeKey(key)] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase Storage : suppression refusée (${res.status}) ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }

  publicUrl(key: string): string {
    return `${this.base}/storage/v1/object/public/${this.bucket}/${assertSafeKey(key)}`;
  }
}
