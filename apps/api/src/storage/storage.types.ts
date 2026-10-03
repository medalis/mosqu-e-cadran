/** Pilote de stockage objet : enregistre, supprime et donne l'URL publique d'un fichier identifié par sa clé. */
export interface StorageDriver {
  readonly name: "local" | "supabase";
  /** Écrit l'objet (remplace s'il existe) et renvoie son URL publique. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /** Supprime l'objet ; ne lève pas s'il est déjà absent. */
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/** Clé d'objet sûre : segments alphanumériques séparés par « / », sans « .. », sans barre initiale. */
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
export function assertSafeKey(key: string): string {
  if (key.length > 300 || !KEY_RE.test(key) || key.split("/").some((s) => s === ".." || s === ".")) throw new Error(`Clé de stockage invalide : ${key}`);
  return key;
}

/** Retrouve la clé (`mosques/<mosqueId>/<fichier>`) à la fin d'une URL publique, quel que soit le pilote qui l'a produite. */
export function keyFromUrl(url: string): string | null {
  const m = /(mosques\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+)(?:\?.*)?$/.exec(url);
  return m ? m[1]! : null;
}
