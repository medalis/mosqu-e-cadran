/** Client HTTP minimal pour les endpoints écran et publics (voir CONTRACT.md). */
import type { AnnouncementInput, JumuaSlot, PrayerDay, ScreenBundle } from "@nidaa/shared";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:4000";
export const APP_VERSION = "screen-0.1.0";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<{ status: number; data: T; etag: string | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: ctrl.signal, headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) } });
    const etag = res.headers.get("ETag");
    if (res.status === 204 || res.status === 304) return { status: res.status, data: undefined as T, etag };
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok && res.status !== 202) {
      const msg = (data && typeof data === "object" && "message" in data && typeof (data as { message: unknown }).message === "string") ? (data as { message: string }).message : `HTTP ${res.status}`;
      throw new ApiError(res.status, msg);
    }
    return { status: res.status, data: data as T, etag };
  } finally { clearTimeout(t); }
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------- écran ----------
export interface PairingStart { code: string; expiresAt: string; pollToken: string }
export const startPairing = () => request<PairingStart>("/v1/screen/pairing", { method: "POST", body: JSON.stringify({ appVersion: APP_VERSION }) }).then((r) => r.data);

export type PollResult = { status: "waiting" } | { status: "paired"; deviceToken: string; mosqueId: string };
export async function pollPairing(code: string, pollToken: string): Promise<PollResult> {
  const r = await request<{ status?: string; deviceToken?: string; mosqueId?: string }>(`/v1/screen/pairing/${encodeURIComponent(code)}?pollToken=${encodeURIComponent(pollToken)}`);
  if (r.status === 200 && r.data?.deviceToken) return { status: "paired", deviceToken: r.data.deviceToken, mosqueId: r.data.mosqueId ?? "" };
  return { status: "waiting" };
}

/** GET /v1/screen/bundle avec If-None-Match ; renvoie null si 304. */
export async function fetchBundle(deviceToken: string, cachedVersion?: number): Promise<ScreenBundle | null> {
  const headers: Record<string, string> = { ...auth(deviceToken) };
  if (cachedVersion != null) headers["If-None-Match"] = `"${cachedVersion}"`;
  const r = await request<ScreenBundle>("/v1/screen/bundle", { headers });
  if (r.status === 304) return null;
  return r.data;
}

export const heartbeat = (deviceToken: string, body: { clockDriftMs: number; bundleVersion: number }) =>
  request<void>("/v1/screen/heartbeat", { method: "POST", headers: auth(deviceToken), body: JSON.stringify({ appVersion: APP_VERSION, ...body }) }, 8_000).then(() => undefined);

export const eventsUrl = (deviceToken: string) => `${API_URL}/v1/screen/events?token=${encodeURIComponent(deviceToken)}`;

// ---------- public (mode aperçu) ----------
export interface PublicMosque {
  id: string; slug: string; name: string; nameAr: string | null; city: string; timezone: string; latitude: number; longitude: number;
  jumua?: JumuaSlot[]; services?: string[]; donationUrl?: string | null;
}
export const fetchPublicMosque = (slug: string) => request<PublicMosque>(`/v1/mosques/${encodeURIComponent(slug)}`).then((r) => r.data);
export const fetchPublicCalendar = (slug: string, month: string) => request<PrayerDay[]>(`/v1/mosques/${encodeURIComponent(slug)}/calendar?month=${month}`).then((r) => r.data);
export const fetchPublicAnnouncements = (slug: string) => request<Array<AnnouncementInput & { id: string }>>(`/v1/mosques/${encodeURIComponent(slug)}/announcements`).then((r) => r.data);
