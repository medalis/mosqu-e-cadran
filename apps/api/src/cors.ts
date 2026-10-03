/**
 * CORS par requête.
 * - Lecture publique (`/v1/mosques*` dont le SSE, `/v1/time`) : toute origine (`*`), sans identifiants, GET/HEAD/OPTIONS —
 *   c'est ce qui permet au widget intégrable et aux sites tiers d'appeler l'API depuis le navigateur.
 * - Tout le reste (`/v1/auth`, `/v1/me`, `/v1/admin`, `/v1/super`, `/v1/screen`, `/docs`) : liste `CORS_ORIGINS` uniquement.
 */
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}

/** Vrai pour les chemins publics en lecture seule. `/v1/admin/mosques` n'en fait pas partie. */
export function isPublicPath(url: string): boolean {
  const path = url.split("?")[0]!.replace(/\/+$/, "");
  return path === "/v1/time" || path === "/v1/mosques" || path.startsWith("/v1/mosques/");
}

export function corsOptionsFor(url: string, origins: string[], production: boolean): CorsOptions {
  if (isPublicPath(url)) {
    return { origin: "*", credentials: false, methods: ["GET", "HEAD", "OPTIONS"], maxAge: 86400 };
  }
  return {
    // Sans liste : tout est accepté en développement, rien en production (échec sûr).
    origin: origins.length ? origins : !production,
    credentials: true,
    exposedHeaders: ["ETag"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 600,
  };
}
