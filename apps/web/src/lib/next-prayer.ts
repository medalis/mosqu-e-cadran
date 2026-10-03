import { PRAYERS, type Prayer, type PrayerDay } from "@nidaa/shared";
import { localToInstant } from "@nidaa/prayer-engine";

export interface NextPrayer { phase: "adhan" | "iqama"; prayer: Prayer; at: Date; tomorrow: boolean }

/** Prochaine échéance dans le fuseau de la mosquée : adhan, ou iqama si l'adhan vient d'être fait. Après Isha : Fajr du lendemain. */
export function nextPrayer(now: Date, timezone: string, today: PrayerDay, tomorrow: PrayerDay | null): NextPrayer {
  for (const p of PRAYERS) {
    const adhan = localToInstant(today.date, today.times[p], timezone);
    if (now < adhan) return { phase: "adhan", prayer: p, at: adhan, tomorrow: false };
    const iqama = localToInstant(today.date, today.iqama[p], timezone);
    if (iqama > adhan && now < iqama) return { phase: "iqama", prayer: p, at: iqama, tomorrow: false };
  }
  const at = tomorrow ? localToInstant(tomorrow.date, tomorrow.times.fajr, timezone) : new Date(localToInstant(today.date, today.times.fajr, timezone).getTime() + 864e5);
  return { phase: "adhan", prayer: "fajr", at, tomorrow: true };
}

export function countdown(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}
