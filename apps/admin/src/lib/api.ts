import type { AuthTokens } from "@nidaa/shared";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const BASE = `${API_URL}/v1`;
const ACCESS_KEY = "nidaa.accessToken";
const REFRESH_KEY = "nidaa.refreshToken";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const isBrowser = () => typeof window !== "undefined";

export const tokens = {
  get access() { return isBrowser() ? localStorage.getItem(ACCESS_KEY) : null; },
  get refresh() { return isBrowser() ? localStorage.getItem(REFRESH_KEY) : null; },
  set(t: AuthTokens) { if (isBrowser()) { localStorage.setItem(ACCESS_KEY, t.accessToken); localStorage.setItem(REFRESH_KEY, t.refreshToken); } },
  clear() { if (isBrowser()) { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); } },
};

function redirectToLogin() {
  if (!isBrowser()) return;
  tokens.clear();
  if (!window.location.pathname.startsWith("/login")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${next}`);
  }
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = tokens.refresh;
    if (!rt) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) });
      if (!res.ok) return false;
      const t = (await res.json()) as AuthTokens;
      tokens.set(t);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  raw?: boolean;
}

function messageOf(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const m = (payload as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(" · ");
    if (typeof m === "string") return m;
  }
  return fallback;
}

export async function request<T>(path: string, opts: RequestOptions = {}, _retried = false): Promise<T> {
  const { method = "GET", body, auth = true, query, raw = false } = opts;
  const url = new URL(`${BASE}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: raw ? "*/*" : "application/json" };
  // FormData (envoi de fichier) : le navigateur fixe lui-même Content-Type avec la frontière multipart.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur. Vérifiez votre connexion ou que l'API est démarrée.");
  }

  if (res.status === 401 && auth && !_retried) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, opts, true);
    redirectToLogin();
    throw new ApiError(401, "Session expirée, veuillez vous reconnecter.");
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (raw) {
    if (!res.ok) throw new ApiError(res.status, `Erreur ${res.status}`);
    return text as T;
  }
  let data: unknown = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const fallback = res.status === 403 ? "Accès refusé." : res.status === 404 ? "Ressource introuvable." : res.status === 413 ? "Fichier trop lourd." : res.status >= 500 ? "Erreur du serveur." : `Erreur ${res.status}`;
    throw new ApiError(res.status, messageOf(data, fallback), data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  /** Envoi multipart : `fields` peut contenir des fichiers (File) et des champs texte. */
  upload: <T>(path: string, fields: Record<string, string | Blob>) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return request<T>(path, { method: "POST", body: form });
  },
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
  text: (path: string) => request<string>(path, { raw: true }),
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Une erreur inattendue est survenue.";
}
