import { createHash, createHmac, randomBytes } from "node:crypto";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "mosquee";
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hmac = (s: string) => createHmac("sha256", process.env.JWT_SECRET ?? "change-me-in-production").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Code d'appairage à 6 caractères sans ambiguïté (pas de 0/O/1/I). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function pairingCode(len = 6): string {
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return out;
}

/** Distance grand-cercle (km) — PostGIS indisponible, calcul en JS. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Parse une durée style "15m", "30d", "900s", "2h" en secondes. */
export function parseTtlSeconds(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const m = v.trim().match(/^(\d+)\s*([smhd]?)$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  return n * ({ "": 1, s: 1, m: 60, h: 3600, d: 86400 } as Record<string, number>)[m[2].toLowerCase()];
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
