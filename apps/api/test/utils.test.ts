import { describe, expect, it } from "vitest";
import { haversineKm, pairingCode, parseTtlSeconds, slugify } from "../src/common/utils";
import { isoDateShiftFrom } from "../src/prayer-times/prayer-day.service";

describe("utils", () => {
  it("slugify normalise les accents et les espaces", () => {
    expect(slugify("Mosquée Al-Rahma")).toBe("mosquee-al-rahma");
    expect(slugify("  ")).toBe("mosquee");
  });
  it("pairingCode : 6 caractères sans 0/O/1/I", () => {
    for (let i = 0; i < 50; i++) expect(pairingCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
  it("haversine : Djibouti → Tadjourah ≈ 38 km", () => {
    expect(haversineKm(11.588, 43.145, 11.785, 42.884)).toBeGreaterThan(30);
    expect(haversineKm(11.588, 43.145, 11.785, 42.884)).toBeLessThan(45);
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });
  it("parseTtlSeconds", () => {
    expect(parseTtlSeconds("15m", 1)).toBe(900);
    expect(parseTtlSeconds("30d", 1)).toBe(30 * 86400);
    expect(parseTtlSeconds("bogus", 7)).toBe(7);
  });
  it("isoDateShiftFrom gère les fins de mois et d'année", () => {
    expect(isoDateShiftFrom("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoDateShiftFrom("2026-03-01", -1)).toBe("2026-02-28");
  });
});
