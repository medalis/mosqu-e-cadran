/**
 * Validation des images envoyées : le type est déterminé par les octets magiques du fichier, jamais par le nom
 * ni par le type MIME annoncé par le navigateur. Fonctions pures (testées dans test/storage.test.ts).
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_MOSQUE = 12;
export const MAX_ANNOUNCEMENT_IMAGES_PER_MOSQUE = 60;
export const MEDIA_KINDS = ["photo", "announcement_image"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface ImageType { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" }
export interface ImageInfo extends ImageType { size: number; width: number | null; height: number | null }

export class ImageValidationError extends Error {
  constructor(public readonly code: "empty" | "too_large" | "unsupported_type" | "limit_reached", message: string) { super(message); }
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Type réel de l'image d'après ses premiers octets ; null si ce n'est ni JPEG, ni PNG, ni WebP. */
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && PNG_SIG.every((b, i) => buf[i] === b)) return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

/** Dimensions lues dans l'en-tête (au mieux : null si l'en-tête est inhabituel — cela ne bloque pas l'envoi). */
export function imageDimensions(buf: Buffer, type: ImageType): { width: number; height: number } | null {
  try {
    if (type.ext === "png") {
      if (buf.length < 24 || buf.toString("latin1", 12, 16) !== "IHDR") return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (type.ext === "jpg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1]!;
        if (marker === 0xff) { i++; continue; }
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
        const len = buf.readUInt16BE(i + 2);
        // SOF0…SOF15 sauf DHT (C4), JPG (C8) et DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        if (len < 2) return null;
        i += 2 + len;
      }
      return null;
    }
    if (buf.length < 30) return null;
    const chunk = buf.toString("latin1", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") { const b = buf.readUInt32LE(21); return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) }; }
    return null;
  } catch {
    return null;
  }
}

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} Mo`;

/** Valide le contenu (non vide, ≤ 5 Mo, JPEG/PNG/WebP réel) et renvoie le type détecté. */
export function validateImage(buf: Buffer | undefined | null, maxBytes = MAX_IMAGE_BYTES): ImageInfo {
  if (!buf || buf.length === 0) throw new ImageValidationError("empty", "Aucun fichier reçu (champ « file » attendu).");
  if (buf.length > maxBytes) throw new ImageValidationError("too_large", `Image trop lourde. La taille maximale est de ${mb(maxBytes)}.`);
  const type = sniffImage(buf);
  if (!type) throw new ImageValidationError("unsupported_type", "Format non accepté : seules les images JPEG, PNG et WebP sont autorisées.");
  const dim = imageDimensions(buf, type);
  return { ...type, size: buf.length, width: dim?.width ?? null, height: dim?.height ?? null };
}

export function limitFor(kind: MediaKind): number {
  return kind === "photo" ? MAX_PHOTOS_PER_MOSQUE : MAX_ANNOUNCEMENT_IMAGES_PER_MOSQUE;
}

/** Refuse l'ajout quand la mosquée a déjà atteint le nombre maximal de fichiers de ce type. */
export function assertUnderLimit(currentCount: number, kind: MediaKind): void {
  const max = limitFor(kind);
  if (currentCount >= max) {
    throw new ImageValidationError("limit_reached", kind === "photo"
      ? `Limite atteinte : ${max} photos au maximum par mosquée. Supprimez-en une avant d'en ajouter.`
      : `Limite atteinte : ${max} images d'annonce au maximum. Supprimez d'anciennes images avant d'en ajouter.`);
  }
}

export function mediaKey(mosqueId: string, uuid: string, ext: string): string {
  return `mosques/${mosqueId}/${uuid}.${ext}`;
}
