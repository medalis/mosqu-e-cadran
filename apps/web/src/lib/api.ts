/** Accès à l'API publique Nidaa (voir CONTRACT.md, section « Public »). Lecture seule, côté serveur. */
import type { JumuaSlot, PrayerDay, Prayer, SpecialPrayer } from "@nidaa/shared";

export const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(/\/$/, "");

export interface MosqueSummary {
  id: string; slug: string; name: string; nameAr: string | null; address: string | null; city: string; countryCode: string;
  latitude: number; longitude: number; timezone: string; services: string[]; version: number; distanceKm?: number;
}
export interface MosqueDetail extends MosqueSummary {
  description: string | null; phone: string | null; email: string | null; website: string | null; donationUrl: string | null;
  status: string; updatedAt: string; jumua: JumuaSlot[]; specialPrayers: SpecialPrayer[]; photos: Photo[];
}
/** Photo de la fiche, dans l'ordre choisi par la mosquée (la première est la photo principale). */
export interface Photo { id: string; url: string; width: number | null; height: number | null }
export type TimesResponse = PrayerDay & { next: { prayer: Prayer; at: string } };
export interface Announcement { id: string; type: "text" | "image" | "video"; title: string; body: string | null; mediaUrl: string | null; startsAt: string | null; endsAt: string | null }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const mosqueTag = (slug: string) => `mosque:${slug}`;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

async function get<T>(path: string, opts: { revalidate?: number; tags?: string[] } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1${path}`, {
      // Jeton interne : exempte le serveur du site de la limite de débit publique de l'API (une seule IP pour tous les visiteurs).
      headers: { accept: "application/json", ...(INTERNAL_TOKEN ? { "x-internal-token": INTERNAL_TOKEN } : {}) },
      signal: AbortSignal.timeout(6000),
      ...(opts.revalidate ? { next: { revalidate: opts.revalidate, tags: opts.tags } } : { cache: "no-store" as const }),
    });
  } catch {
    throw new ApiError(0, "API injoignable");
  }
  if (!res.ok) throw new ApiError(res.status, `API ${res.status}`);
  return (await res.json()) as T;
}

/** Renvoie null sur 404 au lieu de lever. */
async function maybe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
}

const s = (slug: string) => encodeURIComponent(slug);
const cached = (slug: string) => ({ revalidate: 60, tags: [mosqueTag(slug)] });

export function searchMosques(params: { q?: string; lat?: number; lng?: number; radiusKm?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.lat != null && params.lng != null) { qs.set("lat", String(params.lat)); qs.set("lng", String(params.lng)); qs.set("radiusKm", String(params.radiusKm ?? 10)); }
  const q = qs.toString();
  return get<MosqueSummary[]>(`/mosques${q ? `?${q}` : ""}`, q ? {} : { revalidate: 60 });
}
export const getMosque = (slug: string) => maybe(get<MosqueDetail>(`/mosques/${s(slug)}`, cached(slug)));
export const getDay = (slug: string, date: string) => maybe(get<TimesResponse>(`/mosques/${s(slug)}/times?date=${date}`, cached(slug)));
export const getCalendar = (slug: string, month: string) => get<PrayerDay[]>(`/mosques/${s(slug)}/calendar?month=${month}`, cached(slug));
export const getAnnouncements = (slug: string) => get<Announcement[]>(`/mosques/${s(slug)}/announcements`, cached(slug));
