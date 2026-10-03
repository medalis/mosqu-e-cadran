import { describe, expect, it } from "vitest";
import { corsOptionsFor, isPublicPath, parseOrigins } from "../src/cors";

describe("CORS par requête", () => {
  it("reconnaît les chemins publics", () => {
    for (const p of ["/v1/time", "/v1/mosques", "/v1/mosques?q=a", "/v1/mosques/al-rahma", "/v1/mosques/al-rahma/events", "/v1/mosques/al-rahma/times?date=2026-10-03"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/v1/me", "/v1/auth/login", "/v1/admin/mosques", "/v1/admin/mosques/x", "/v1/super/mosques", "/v1/screen/bundle", "/v1/mosquesX", "/v1/timezone", "/docs"]) expect(isPublicPath(p)).toBe(false);
  });
  it("ouvre le public à toute origine, sans identifiants, en lecture seule", () => {
    const o = corsOptionsFor("/v1/mosques/al-rahma/events", ["https://admin.nidaa.dj"], true);
    expect(o.origin).toBe("*");
    expect(o.credentials).toBe(false);
    expect(o.methods).toEqual(["GET", "HEAD", "OPTIONS"]);
  });
  it("restreint le reste à CORS_ORIGINS", () => {
    const origins = parseOrigins("https://admin.nidaa.dj/, https://ecran.nidaa.dj");
    expect(origins).toEqual(["https://admin.nidaa.dj", "https://ecran.nidaa.dj"]);
    const o = corsOptionsFor("/v1/me", origins, true);
    expect(o.origin).toEqual(origins);
    expect(o.credentials).toBe(true);
    expect(corsOptionsFor("/v1/me", [], true).origin).toBe(false);
    expect(corsOptionsFor("/v1/me", [], false).origin).toBe(true);
  });
});
