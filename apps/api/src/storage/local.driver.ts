import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { type StorageDriver, assertSafeKey } from "./storage.types";

/**
 * Pilote « local » : fichiers sous STORAGE_LOCAL_DIR, servis par l'API sur /v1/files/<clé>.
 * Défaut en développement ; utilisable sur la VM unique avec un volume. À proscrire sur un hébergeur à disque
 * éphémère (Render, Railway, Fly sans volume) : les fichiers y disparaissent à chaque redéploiement.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;
  readonly root: string;
  private readonly baseUrl: string;

  constructor(opts: { dir: string; publicBaseUrl: string }) {
    this.root = resolve(opts.dir);
    this.baseUrl = opts.publicBaseUrl.replace(/\/+$/, "");
  }

  /** Chemin absolu de la clé, garanti à l'intérieur du dossier racine. */
  pathFor(key: string): string {
    const p = resolve(this.root, assertSafeKey(key));
    if (!p.startsWith(this.root + sep)) throw new Error(`Clé de stockage invalide : ${key}`);
    return p;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<string> {
    const p = this.pathFor(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
    return this.publicUrl(key);
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/v1/files/${assertSafeKey(key)}`;
  }
}
