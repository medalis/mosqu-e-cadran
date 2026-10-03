/**
 * @nidaa/prayer-engine — résout les horaires d'une mosquée pour une date donnée.
 * Même code côté serveur (table prayer_day), écran (recalcul hors ligne au-delà du cache) et mobile.
 *
 * Règle d'or : l'horaire de la mosquée fait foi. Un calendrier importé ou une correction manuelle
 * remplace toujours le calcul astronomique ; le calcul n'est qu'une proposition.
 */
import { Coordinates, CalculationMethod, CalculationParameters, PrayerTimes, Madhab, HighLatitudeRule } from "adhan";
import { HIJRI_MONTHS_AR, HIJRI_MONTHS_FR, PRAYERS, type IqamaRule, type Prayer, type PrayerConfig, type PrayerDay, type TimeKey } from "@nidaa/shared";

export interface ResolveInput {
  date: Date | string;          // jour civil (dans le fuseau de la mosquée) — "YYYY-MM-DD" ou Date
  latitude: number;
  longitude: number;
  timezone: string;             // IANA, ex. "Africa/Djibouti"
  config: PrayerConfig;
  iqamaRules: IqamaRule[];
  /** Horaires imposés (calendrier importé ou correction manuelle) : remplacent le calcul pour les clés présentes. */
  override?: Partial<Record<TimeKey, string>>;
  overrideSource?: "calendar" | "override";
}

// ---------- utilitaires temps ----------
const pad = (n: number) => String(n).padStart(2, "0");

/** Composantes locales d'un instant dans un fuseau donné. */
export function partsIn(date: Date, timezone: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour === 24 ? 0 : p.hour, minute: p.minute, second: p.second };
}

/** "HH:MM" local d'un instant. */
export function formatHM(date: Date, timezone: string): string {
  const { hour, minute } = partsIn(date, timezone);
  return `${pad(hour)}:${pad(minute)}`;
}

/** Décalage (ms) du fuseau à un instant donné. */
function tzOffsetMs(date: Date, timezone: string): number {
  const p = partsIn(date, timezone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant UTC correspondant à une heure locale "HH:MM" d'un jour civil "YYYY-MM-DD" dans un fuseau. Gère les changements d'heure. */
export function localToInstant(isoDate: string, hm: string, timezone: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off1 = tzOffsetMs(guess, timezone);
  let t = new Date(guess.getTime() - off1);
  const off2 = tzOffsetMs(t, timezone);
  if (off2 !== off1) t = new Date(guess.getTime() - off2);
  return t;
}

export function toIsoDate(date: Date, timezone: string): string {
  const p = partsIn(date, timezone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function addMinutes(hm: string, min: number): string {
  const [h, m] = hm.split(":").map(Number);
  const total = (((h * 60 + m + min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// ---------- calcul ----------
function buildParams(config: PrayerConfig): CalculationParameters {
  const base: Record<string, () => CalculationParameters> = {
    MWL: CalculationMethod.MuslimWorldLeague, UmmAlQura: CalculationMethod.UmmAlQura, Egyptian: CalculationMethod.Egyptian, Karachi: CalculationMethod.Karachi,
    Dubai: CalculationMethod.Dubai, Kuwait: CalculationMethod.Kuwait, Qatar: CalculationMethod.Qatar, Singapore: CalculationMethod.Singapore, Tehran: CalculationMethod.Tehran,
    Turkey: CalculationMethod.Turkey, NorthAmerica: CalculationMethod.NorthAmerica, MoonsightingCommittee: CalculationMethod.MoonsightingCommittee, Custom: CalculationMethod.Other,
  };
  const params = (base[config.method] ?? CalculationMethod.MuslimWorldLeague)();
  if (config.fajrAngle != null) params.fajrAngle = config.fajrAngle;
  if (config.ishaAngle != null) { params.ishaAngle = config.ishaAngle; params.ishaInterval = 0; }
  if (config.ishaIntervalMin != null) params.ishaInterval = config.ishaIntervalMin;
  params.madhab = config.asrMadhhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = { MiddleOfTheNight: HighLatitudeRule.MiddleOfTheNight, SeventhOfTheNight: HighLatitudeRule.SeventhOfTheNight, TwilightAngle: HighLatitudeRule.TwilightAngle }[config.highLatitudeRule];
  return params;
}

/** Horaires astronomiques bruts (avant ajustements manuels), en "HH:MM" local. */
export function computeTimes(isoDate: string, latitude: number, longitude: number, timezone: string, config: PrayerConfig): Record<TimeKey, string> {
  // adhan attend une Date dont year/month/day (locaux à la machine) représentent le jour voulu ; on lui passe midi UTC du jour civil, ce qui est stable quel que soit le fuseau de la machine.
  const [y, m, d] = isoDate.split("-").map(Number);
  const pt = new PrayerTimes(new Coordinates(latitude, longitude), new Date(Date.UTC(y, m - 1, d, 12)), buildParams(config));
  return { fajr: formatHM(pt.fajr, timezone), shuruq: formatHM(pt.sunrise, timezone), dhuhr: formatHM(pt.dhuhr, timezone), asr: formatHM(pt.asr, timezone), maghrib: formatHM(pt.maghrib, timezone), isha: formatHM(pt.isha, timezone) };
}

export function resolveIqama(times: Record<TimeKey, string>, rules: IqamaRule[]): Record<Prayer, string> {
  const out = {} as Record<Prayer, string>;
  for (const p of PRAYERS) {
    const r = rules.find((x) => x.prayer === p);
    if (!r) out[p] = addMinutes(times[p], p === "maghrib" ? 5 : 15);
    else if (r.mode === "fixed" && r.fixedTime) out[p] = r.fixedTime;
    else out[p] = addMinutes(times[p], r.delayMin ?? 0);
  }
  return out;
}

// ---------- hégirien ----------
export function hijriOf(isoDate: string, offsetDays = 0) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12) + offsetDays * 864e5);
  const f = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric" });
  const p = Object.fromEntries(f.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, parseInt(x.value, 10)]));
  const month = p.month as number;
  return { day: p.day as number, month, year: p.year as number, monthNameAr: HIJRI_MONTHS_AR[month - 1], monthNameFr: HIJRI_MONTHS_FR[month - 1] };
}

// ---------- résolution complète d'un jour ----------
export function resolveDay(input: ResolveInput): PrayerDay {
  const isoDate = typeof input.date === "string" ? input.date : toIsoDate(input.date, input.timezone);
  const computed = computeTimes(isoDate, input.latitude, input.longitude, input.timezone, input.config);
  const adj = input.config.adjustments;
  const times = { ...computed } as Record<TimeKey, string>;
  for (const k of Object.keys(times) as TimeKey[]) times[k] = addMinutes(times[k], adj[k] ?? 0);
  let source: PrayerDay["source"] = "calculated";
  if (input.override) {
    for (const k of Object.keys(input.override) as TimeKey[]) { const v = input.override[k]; if (v) times[k] = v; }
    source = input.overrideSource ?? "override";
  }
  return { date: isoDate, hijri: hijriOf(isoDate, input.config.hijriOffsetDays), times, iqama: resolveIqama(times, input.iqamaRules), source };
}

/** Résout une plage de jours [from, from + days). */
export function resolveRange(input: Omit<ResolveInput, "date" | "override" | "overrideSource">, fromIso: string, days: number, overrides: Record<string, { times: Partial<Record<TimeKey, string>>; source: "calendar" | "override" }> = {}): PrayerDay[] {
  const [y, m, d] = fromIso.split("-").map(Number);
  const out: PrayerDay[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
    const iso = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    const ov = overrides[iso];
    out.push(resolveDay({ ...input, date: iso, override: ov?.times, overrideSource: ov?.source }));
  }
  return out;
}

// ---------- état de l'écran à un instant ----------
export type ScreenState = { state: "idle"; next: Prayer; nextAt: Date; prevAt: Date; current?: undefined } | { state: "adhan" | "dua" | "iqama" | "prayer" | "adhkar"; current: Prayer; adhanAt: Date; iqamaAt: Date; next: Prayer; nextAt: Date; prevAt: Date };

export interface StateDurations { adhan: number; iqama: number; prayer: Record<Prayer, number>; adhkar: number }

/** Détermine l'état d'affichage pour un instant, à partir des jours résolus (hier, aujourd'hui, demain). */
export function screenStateAt(now: Date, timezone: string, days: PrayerDay[], durations: StateDurations): ScreenState | null {
  const today = toIsoDate(now, timezone);
  const idx = days.findIndex((d) => d.date === today);
  if (idx < 0) return null;
  const d = days[idx], prev = days[idx - 1], nxt = days[idx + 1];
  const at = (iso: string, hm: string) => localToInstant(iso, hm, timezone);
  const m = 6e4;
  for (const p of PRAYERS) {
    const a = at(d.date, d.times[p]), i = at(d.date, d.iqama[p]);
    const n = now.getTime(), aT = a.getTime(), iT = i.getTime();
    const nextInfo = nextOf(p);
    if (n >= aT && n < aT + durations.adhan * m) return { state: "adhan", current: p, adhanAt: a, iqamaAt: i, ...nextInfo };
    if (n >= aT + durations.adhan * m && n < iT) return { state: "dua", current: p, adhanAt: a, iqamaAt: i, ...nextInfo };
    if (n >= iT && n < iT + durations.iqama * m) return { state: "iqama", current: p, adhanAt: a, iqamaAt: i, ...nextInfo };
    if (n >= iT + durations.iqama * m && n < iT + (durations.iqama + durations.prayer[p]) * m) return { state: "prayer", current: p, adhanAt: a, iqamaAt: i, ...nextInfo };
    if (n >= iT + (durations.iqama + durations.prayer[p]) * m && n < iT + (durations.iqama + durations.prayer[p] + durations.adhkar) * m) return { state: "adhkar", current: p, adhanAt: a, iqamaAt: i, ...nextInfo };
  }
  // prochaine prière
  for (const p of PRAYERS) { const a = at(d.date, d.times[p]); if (now < a) return { state: "idle", next: p, nextAt: a, prevAt: prevOf(p) }; }
  const fajrTomorrow = nxt ? at(nxt.date, nxt.times.fajr) : new Date(at(d.date, d.times.fajr).getTime() + 864e5);
  return { state: "idle", next: "fajr", nextAt: fajrTomorrow, prevAt: at(d.date, d.times.isha) };

  function nextOf(p: Prayer): { next: Prayer; nextAt: Date; prevAt: Date } {
    const i = PRAYERS.indexOf(p);
    if (i < PRAYERS.length - 1) { const q = PRAYERS[i + 1]; return { next: q, nextAt: at(d.date, d.times[q]), prevAt: at(d.date, d.times[p]) }; }
    const fajrTomorrow = nxt ? at(nxt.date, nxt.times.fajr) : new Date(at(d.date, d.times.fajr).getTime() + 864e5);
    return { next: "fajr", nextAt: fajrTomorrow, prevAt: at(d.date, d.times.isha) };
  }
  function prevOf(p: Prayer): Date {
    const i = PRAYERS.indexOf(p);
    if (i > 0) return at(d.date, d.times[PRAYERS[i - 1]]);
    return prev ? at(prev.date, prev.times.isha) : new Date(at(d.date, d.times.isha).getTime() - 864e5);
  }
}

// ---------- import CSV ----------
/** Analyse un calendrier CSV "date,fajr,shuruq,dhuhr,asr,maghrib,isha" (en-tête obligatoire, séparateur , ou ;). */
export function parseCalendarCsv(text: string): { rows: Array<{ date: string; times: Record<TimeKey, string> }>; errors: Array<{ line: number; message: string }> } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: Array<{ line: number; message: string }> = [];
  const rows: Array<{ date: string; times: Record<TimeKey, string> }> = [];
  if (!lines.length) return { rows, errors: [{ line: 0, message: "Fichier vide" }] };
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const want = ["date", "fajr", "shuruq", "dhuhr", "asr", "maghrib", "isha"];
  const idx = want.map((w) => header.indexOf(w));
  if (idx.some((i) => i < 0)) return { rows, errors: [{ line: 1, message: `En-tête attendu : ${want.join(sep)}` }] };
  const hm = /^([01]?\d|2[0-3]):[0-5]\d$/;
  lines.slice(1).forEach((l, i) => {
    const c = l.split(sep).map((x) => x.trim());
    const date = normalizeDate(c[idx[0]]);
    if (!date) { errors.push({ line: i + 2, message: `Date invalide « ${c[idx[0]]} » (attendu YYYY-MM-DD ou DD/MM/YYYY)` }); return; }
    const t: Partial<Record<TimeKey, string>> = {};
    for (let k = 1; k < want.length; k++) {
      const v = c[idx[k]];
      if (!hm.test(v ?? "")) { errors.push({ line: i + 2, message: `Heure invalide pour ${want[k]} : « ${v} »` }); return; }
      const [h, mm] = v.split(":"); t[want[k] as TimeKey] = `${pad(Number(h))}:${mm}`;
    }
    rows.push({ date, times: t as Record<TimeKey, string> });
  });
  return { rows, errors };
}
function normalizeDate(s: string | undefined): string | null {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

export { PRAYERS };
