/** Modèle dérivé du jour courant : instants UTC de chaque horaire, étendu hors cache si besoin. */
import { localToInstant, resolveRange, screenStateAt, toIsoDate, type ScreenState, type StateDurations } from "@nidaa/prayer-engine";
import { PRAYERS, TIMES, type Prayer, type PrayerDay, type ScreenBundle, type TimeKey } from "@nidaa/shared";

export interface DayModel {
  today: PrayerDay;
  at: Record<TimeKey, Date>;
  iqamaAt: Record<Prayer, Date>;
  prevIsha: Date;
  fajrTomorrow: Date;
}

const shiftIso = (iso: string, delta: number) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + delta, 12)).toISOString().slice(0, 10); };

/** Garantit que hier, aujourd'hui et demain sont présents : au-delà du cache (hors ligne > 30 j), on recalcule avec le moteur partagé. */
export function ensureDays(bundle: ScreenBundle, todayIso: string): PrayerDay[] {
  const have = new Set(bundle.days.map((d) => d.date));
  const need = [shiftIso(todayIso, -1), todayIso, shiftIso(todayIso, 1)];
  if (need.every((d) => have.has(d))) return bundle.days;
  const extra = resolveRange(
    { latitude: bundle.mosque.latitude, longitude: bundle.mosque.longitude, timezone: bundle.mosque.timezone, config: bundle.prayerConfig, iqamaRules: bundle.iqamaRules },
    need[0], 45,
  ).filter((d) => !have.has(d.date));
  return [...bundle.days, ...extra].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildDayModel(days: PrayerDay[], todayIso: string, tz: string): DayModel | null {
  const idx = days.findIndex((d) => d.date === todayIso);
  if (idx < 0) return null;
  const today = days[idx], prev = days[idx - 1], next = days[idx + 1];
  const at = {} as Record<TimeKey, Date>;
  for (const k of TIMES) at[k] = localToInstant(today.date, today.times[k], tz);
  const iqamaAt = {} as Record<Prayer, Date>;
  for (const p of PRAYERS) iqamaAt[p] = localToInstant(today.date, today.iqama[p], tz);
  const prevIsha = prev ? localToInstant(prev.date, prev.times.isha, tz) : new Date(at.isha.getTime() - 864e5);
  const fajrTomorrow = next ? localToInstant(next.date, next.times.fajr, tz) : new Date(at.fajr.getTime() + 864e5);
  return { today, at, iqamaAt, prevIsha, fajrTomorrow };
}

export function durationsOf(bundle: ScreenBundle): StateDurations {
  const d = bundle.settings.durations;
  const prayer = { fajr: 10, dhuhr: 10, asr: 10, maghrib: 8, isha: 12, ...(d.prayer ?? {}) } as Record<Prayer, number>;
  return { adhan: d.adhan ?? 3, iqama: d.iqama ?? 1, prayer, adhkar: d.adhkar ?? 5 };
}

export function stateAt(now: Date, bundle: ScreenBundle, days: PrayerDay[]): ScreenState | null {
  return screenStateAt(now, bundle.mosque.timezone, days, durationsOf(bundle));
}

export { toIsoDate };

const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDur = (ms: number) => { ms = Math.max(0, ms); const s = Math.floor(ms / 1e3); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
export const fmtDurShort = (ms: number) => { ms = Math.max(0, ms); const s = Math.floor(ms / 1e3); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
