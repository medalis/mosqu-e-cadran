import type { PrayerDay } from "@nidaa/shared";

export const SERVICE_LABELS: Record<string, string> = {
  women_space: "Salle de prière femmes",
  accessible: "Accès PMR",
  parking: "Parking",
  ablutions: "Salle d'ablutions",
  classes: "Cours et conférences",
  library: "Bibliothèque",
  funeral: "Services funéraires",
  quran_school: "École coranique",
  iftar: "Iftar du Ramadan",
};
export const SPECIAL_LABELS: Record<string, string> = { eid_fitr: "Aïd al-Fitr", eid_adha: "Aïd al-Adha", tarawih: "Tarawih", other: "Prière" };
export const LANG_LABELS: Record<string, string> = { fr: "français", ar: "arabe", en: "anglais", so: "somali", aa: "afar" };

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const longDate = (iso: string, locale = "fr-FR") => cap(new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(utc(iso)));
export const monthLabel = (ym: string) => cap(new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(`${ym}-01`)));
export const weekdayShort = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(utc(iso)).replace(".", "");
export const isFriday = (iso: string) => utc(iso).getUTCDay() === 5;
export const hijriFr = (h: PrayerDay["hijri"]) => `${h.day} ${h.monthNameFr} ${h.year}`;
export const hijriAr = (h: PrayerDay["hijri"]) => `${h.day.toLocaleString("ar-EG")} ${h.monthNameAr} ${h.year.toLocaleString("ar-EG", { useGrouping: false })}`;

export function shiftIso(iso: string, days: number): string {
  const d = utc(iso); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** N'accepte que http(s) — les URL viennent de la saisie des responsables. */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try { const p = new URL(u); return p.protocol === "http:" || p.protocol === "https:" ? p.toString() : null; } catch { return null; }
}
export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);
