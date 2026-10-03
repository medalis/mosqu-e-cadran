import { Injectable, Logger } from "@nestjs/common";
import { resolve } from "node:path";
import { LocalStorageDriver } from "./local.driver";
import { SupabaseStorageDriver } from "./supabase.driver";
import type { StorageDriver } from "./storage.types";

type Env = Record<string, string | undefined>;

/** Construit le pilote d'après l'environnement : STORAGE_DRIVER=local (défaut) | supabase. */
export function createStorageDriver(env: Env = process.env): StorageDriver {
  const driver = (env.STORAGE_DRIVER ?? "local").trim().toLowerCase();
  if (driver === "supabase") {
    return new SupabaseStorageDriver({ url: env.SUPABASE_URL ?? "", serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "", bucket: env.STORAGE_BUCKET?.trim() || "nidaa-media" });
  }
  if (driver !== "local") throw new Error(`STORAGE_DRIVER invalide : « ${driver} » (local | supabase)`);
  return new LocalStorageDriver({
    dir: resolve(env.STORAGE_LOCAL_DIR?.trim() || "storage"),
    // URL publique de l'API, telle que vue par les navigateurs (les URL des photos sont enregistrées en base).
    publicBaseUrl: env.PUBLIC_API_URL?.trim() || `http://localhost:${env.PORT ?? 4000}`,
  });
}

@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  readonly driver: StorageDriver = createStorageDriver();

  constructor() {
    this.log.log(`Stockage des médias : pilote « ${this.driver.name} »${this.driver instanceof LocalStorageDriver ? ` (${this.driver.root})` : ""}`);
    if (this.driver.name === "local" && process.env.NODE_ENV === "production" && !process.env.PUBLIC_API_URL) {
      this.log.warn("PUBLIC_API_URL n'est pas défini : les URL des photos pointeront vers localhost.");
    }
  }

  put(key: string, body: Buffer, contentType: string) { return this.driver.put(key, body, contentType); }
  remove(key: string) { return this.driver.remove(key); }
  publicUrl(key: string) { return this.driver.publicUrl(key); }
  /** Dossier racine quand le pilote est local, sinon null (les fichiers ne sont alors pas servis par l'API). */
  get localDriver(): LocalStorageDriver | null { return this.driver instanceof LocalStorageDriver ? this.driver : null; }
}
