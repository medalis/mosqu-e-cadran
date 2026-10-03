import { describe, it, expect } from "vitest";
import { resolveDay, resolveRange, screenStateAt, parseCalendarCsv, localToInstant, hijriOf } from "./index.js";
import { PrayerConfigSchema } from "@nidaa/shared";

const DJ = { latitude: 11.588, longitude: 43.145, timezone: "Africa/Djibouti" };
const config = PrayerConfigSchema.parse({ method: "MWL", adjustments: { fajr: 2, maghrib: 3 } });
const iqama = [
  { prayer: "fajr", mode: "delay", delayMin: 20, fixedTime: null }, { prayer: "dhuhr", mode: "delay", delayMin: 15, fixedTime: null },
  { prayer: "asr", mode: "delay", delayMin: 15, fixedTime: null }, { prayer: "maghrib", mode: "delay", delayMin: 5, fixedTime: null },
  { prayer: "isha", mode: "fixed", delayMin: null, fixedTime: "19:30" },
] as const;

const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };

describe("resolveDay — Djibouti", () => {
  const day = resolveDay({ ...DJ, date: "2026-10-03", config, iqamaRules: [...iqama] });
  it("donne des horaires plausibles pour Djibouti début octobre", () => {
    expect(toMin(day.times.fajr)).toBeGreaterThan(toMin("04:30"));
    expect(toMin(day.times.fajr)).toBeLessThan(toMin("05:10"));
    expect(toMin(day.times.dhuhr)).toBeGreaterThan(toMin("11:45"));
    expect(toMin(day.times.dhuhr)).toBeLessThan(toMin("12:15"));
    expect(toMin(day.times.maghrib)).toBeGreaterThan(toMin("17:45"));
    expect(toMin(day.times.maghrib)).toBeLessThan(toMin("18:15"));
  });
  it("ordonne les prières et applique les ajustements", () => {
    const t = day.times;
    expect(toMin(t.fajr)).toBeLessThan(toMin(t.shuruq));
    expect(toMin(t.shuruq)).toBeLessThan(toMin(t.dhuhr));
    expect(toMin(t.dhuhr)).toBeLessThan(toMin(t.asr));
    expect(toMin(t.asr)).toBeLessThan(toMin(t.maghrib));
    expect(toMin(t.maghrib)).toBeLessThan(toMin(t.isha));
    const raw = resolveDay({ ...DJ, date: "2026-10-03", config: { ...config, adjustments: { ...config.adjustments, fajr: 0 } }, iqamaRules: [] });
    expect(toMin(day.times.fajr) - toMin(raw.times.fajr)).toBe(2);
  });
  it("résout l'iqama en délai ou en heure fixe", () => {
    expect(toMin(day.iqama.fajr) - toMin(day.times.fajr)).toBe(20);
    expect(day.iqama.isha).toBe("19:30");
  });
  it("fournit la date hégirienne", () => {
    expect(day.hijri.year).toBeGreaterThanOrEqual(1447);
    expect(day.hijri.monthNameAr.length).toBeGreaterThan(0);
    expect(hijriOf("2026-10-03", 1).day).not.toBe(hijriOf("2026-10-03", 0).day);
  });
  it("laisse un calendrier importé primer sur le calcul", () => {
    const d = resolveDay({ ...DJ, date: "2026-10-03", config, iqamaRules: [...iqama], override: { fajr: "04:30" }, overrideSource: "calendar" });
    expect(d.times.fajr).toBe("04:30");
    expect(d.iqama.fajr).toBe("04:50");
    expect(d.source).toBe("calendar");
  });
});

describe("resolveRange", () => {
  it("produit N jours consécutifs", () => {
    const days = resolveRange({ ...DJ, config, iqamaRules: [...iqama] }, "2026-12-30", 4);
    expect(days.map((d) => d.date)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

describe("screenStateAt", () => {
  const days = resolveRange({ ...DJ, config, iqamaRules: [...iqama] }, "2026-10-02", 3);
  const today = days[1];
  const dur = { adhan: 3, iqama: 1, prayer: { fajr: 10, dhuhr: 10, asr: 10, maghrib: 8, isha: 12 }, adhkar: 5 };
  const at = (hm: string, plusMin = 0) => new Date(localToInstant("2026-10-03", hm, DJ.timezone).getTime() + plusMin * 6e4);
  it("est idle entre les prières, avec la bonne prochaine prière", () => {
    const s = screenStateAt(at("10:00"), DJ.timezone, days, dur)!;
    expect(s.state).toBe("idle"); expect(s.next).toBe("dhuhr");
  });
  it("enchaîne adhan → dua → iqama → prière → adhkar", () => {
    expect(screenStateAt(at(today.times.dhuhr, 1), DJ.timezone, days, dur)!.state).toBe("adhan");
    expect(screenStateAt(at(today.times.dhuhr, 5), DJ.timezone, days, dur)!.state).toBe("dua");
    expect(screenStateAt(at(today.iqama.dhuhr, 0), DJ.timezone, days, dur)!.state).toBe("iqama");
    expect(screenStateAt(at(today.iqama.dhuhr, 4), DJ.timezone, days, dur)!.state).toBe("prayer");
    expect(screenStateAt(at(today.iqama.dhuhr, 13), DJ.timezone, days, dur)!.state).toBe("adhkar");
    expect(screenStateAt(at(today.iqama.dhuhr, 20), DJ.timezone, days, dur)!.state).toBe("idle");
  });
  it("après Isha, la prochaine prière est le Fajr de demain", () => {
    const s = screenStateAt(at("23:00"), DJ.timezone, days, dur)!;
    expect(s.state).toBe("idle"); expect(s.next).toBe("fajr");
    expect(s.nextAt.getTime()).toBeGreaterThan(at("23:00").getTime());
  });
});

describe("parseCalendarCsv", () => {
  it("accepte , ou ; et les dates DD/MM/YYYY", () => {
    const r = parseCalendarCsv("date;fajr;shuruq;dhuhr;asr;maghrib;isha\n01/01/2027;5:05;06:20;12:05;15:20;18:00;19:15");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toEqual({ date: "2027-01-01", times: { fajr: "05:05", shuruq: "06:20", dhuhr: "12:05", asr: "15:20", maghrib: "18:00", isha: "19:15" } });
  });
  it("signale les lignes invalides avec leur numéro", () => {
    const r = parseCalendarCsv("date,fajr,shuruq,dhuhr,asr,maghrib,isha\n2027-01-01,05:05,06:20,12:05,15:20,18:00,19:15\n2027-01-02,xx,06:20,12:05,15:20,18:00,19:15");
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0].line).toBe(3);
  });
});
