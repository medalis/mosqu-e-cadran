import type { MosqueStatus, Prayer, TimeKey } from "@nidaa/shared";

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export const STATUS_LABEL: Record<MosqueStatus, string> = { draft: "Brouillon", pending: "En attente de validation", published: "Publiée", rejected: "Refusée", suspended: "Suspendue" };
export const STATUS_TONE: Record<MosqueStatus, "neutral" | "warning" | "success" | "danger"> = { draft: "neutral", pending: "warning", published: "success", rejected: "danger", suspended: "danger" };

export const ROLE_LABEL = { owner: "Propriétaire", admin: "Administrateur", editor: "Éditeur" } as const;
export const SERVICE_LABEL: Record<string, string> = {
  women_space: "Salle des femmes", accessible: "Accès PMR", parking: "Parking", ablutions: "Salle d'ablutions", classes: "Cours", library: "Bibliothèque", funeral: "Service funéraire", quran_school: "École coranique", iftar: "Iftar (Ramadan)",
};
export const METHOD_LABEL: Record<string, string> = {
  MWL: "Ligue islamique mondiale (MWL)", UmmAlQura: "Umm al-Qura (La Mecque)", Egyptian: "Autorité égyptienne", Karachi: "Université de Karachi", Dubai: "Dubaï", Kuwait: "Koweït", Qatar: "Qatar", Singapore: "Singapour", Tehran: "Téhéran", Turkey: "Diyanet (Turquie)", NorthAmerica: "ISNA (Amérique du Nord)", MoonsightingCommittee: "Moonsighting Committee", Custom: "Personnalisée",
};
export const HIGH_LAT_LABEL: Record<string, string> = { MiddleOfTheNight: "Milieu de la nuit", SeventhOfTheNight: "Septième de la nuit", TwilightAngle: "Angle du crépuscule" };
export const THEME_SWATCH: Record<string, { bg: string; fg: string; accent: string; label: string }> = {
  nuit: { bg: "#0f1b2d", fg: "#f5f1e6", accent: "#c7a248", label: "Nuit" },
  emeraude: { bg: "#0e3b33", fg: "#f1f7f4", accent: "#d9bd6e", label: "Émeraude" },
  bordeaux: { bg: "#4a1420", fg: "#f8efe9", accent: "#e3c27a", label: "Bordeaux" },
  ottoman: { bg: "#1d2a44", fg: "#f5efe0", accent: "#b7483f", label: "Ottoman" },
  sable: { bg: "#e9dcc3", fg: "#3b2f1d", accent: "#2c8c80", label: "Sable" },
  ivoire: { bg: "#f7f3ea", fg: "#2b2b2b", accent: "#9a7a2f", label: "Ivoire" },
};
export const KIND_LABEL: Record<string, string> = { hadith: "Hadith", ayah: "Verset", dua: "Invocation", dhikr: "Dhikr" };
export const CONTEXT_LABEL: Record<string, string> = { after_adhan: "Après l'adhan", after_prayer: "Après la prière", rotation: "Rotation" };
export const SPECIAL_KIND_LABEL: Record<string, string> = { eid_fitr: "Aïd al-Fitr", eid_adha: "Aïd al-Adha", tarawih: "Tarawih", other: "Autre" };

export const PRAYER_FR: Record<TimeKey, string> = { fajr: "Fajr", shuruq: "Shuruq", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
export const PRAYERS5: Prayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export function todayIso(timezone?: string): string {
  const d = new Date();
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    return f.format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}
export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", opts).format(d);
}
export function fmtDateTime(iso: string | null | undefined): string { return fmtDate(iso, { dateStyle: "short", timeStyle: "short" }); }
export function fmtDayLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
export const isOnline = (lastSeenAt: string | null | undefined) => !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
export const emptyToNull = { setValueAs: (v: unknown) => (v === "" || v === undefined ? null : v) };
export const numOrNull = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v)) };
export const asNumber = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? 0 : Number(v)) };
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
