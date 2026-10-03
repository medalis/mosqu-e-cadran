/**
 * @nidaa/shared — contrats communs à l'API, au back-office et à l'écran.
 * Toutes les heures « HH:MM » sont en heure locale de la mosquée (fuseau IANA `timezone`).
 */
import { z } from "zod";

// ---------- Énumérations ----------
export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type Prayer = (typeof PRAYERS)[number];
export const TIMES = ["fajr", "shuruq", "dhuhr", "asr", "maghrib", "isha"] as const;
export type TimeKey = (typeof TIMES)[number];

export const CALC_METHODS = ["MWL", "UmmAlQura", "Egyptian", "Karachi", "Dubai", "Kuwait", "Qatar", "Singapore", "Tehran", "Turkey", "NorthAmerica", "MoonsightingCommittee", "Custom"] as const;
export type CalcMethod = (typeof CALC_METHODS)[number];
export const MADHHABS = ["shafi", "hanafi"] as const;
export const HIGH_LAT_RULES = ["MiddleOfTheNight", "SeventhOfTheNight", "TwilightAngle"] as const;
export const MOSQUE_STATUS = ["draft", "pending", "published", "rejected", "suspended"] as const;
export type MosqueStatus = (typeof MOSQUE_STATUS)[number];
export const MEMBER_ROLES = ["owner", "admin", "editor"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const SCREEN_THEMES = ["nuit", "emeraude", "bordeaux", "ottoman", "sable", "ivoire"] as const;
export type ScreenTheme = (typeof SCREEN_THEMES)[number];
export const SERVICES = ["women_space", "accessible", "parking", "ablutions", "classes", "library", "funeral", "quran_school", "iftar"] as const;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM attendu");
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu");

// ---------- Configuration des horaires ----------
export const PrayerAdjustments = z.object({ fajr: z.number().int().min(-60).max(60).default(0), shuruq: z.number().int().min(-60).max(60).default(0), dhuhr: z.number().int().min(-60).max(60).default(0), asr: z.number().int().min(-60).max(60).default(0), maghrib: z.number().int().min(-60).max(60).default(0), isha: z.number().int().min(-60).max(60).default(0) });
export type PrayerAdjustments = z.infer<typeof PrayerAdjustments>;

export const PrayerConfigSchema = z.object({
  source: z.enum(["calculated", "calendar"]).default("calculated"),
  method: z.enum(CALC_METHODS).default("MWL"),
  fajrAngle: z.number().min(10).max(24).nullable().default(null),
  ishaAngle: z.number().min(10).max(24).nullable().default(null),
  ishaIntervalMin: z.number().int().min(0).max(180).nullable().default(null),
  asrMadhhab: z.enum(MADHHABS).default("shafi"),
  highLatitudeRule: z.enum(HIGH_LAT_RULES).default("MiddleOfTheNight"),
  adjustments: PrayerAdjustments.default({}),
  hijriOffsetDays: z.number().int().min(-2).max(2).default(0),
});
export type PrayerConfig = z.infer<typeof PrayerConfigSchema>;

export const IqamaRuleSchema = z.object({
  prayer: z.enum(PRAYERS),
  mode: z.enum(["delay", "fixed"]),
  delayMin: z.number().int().min(0).max(120).nullable().default(null),
  fixedTime: HHMM.nullable().default(null),
}).refine((r) => (r.mode === "delay" ? r.delayMin != null : r.fixedTime != null), { message: "delayMin requis en mode delay, fixedTime en mode fixed" });
export type IqamaRule = z.infer<typeof IqamaRuleSchema>;
export const IqamaRulesSchema = z.array(IqamaRuleSchema).max(5);

export const JumuaSlotSchema = z.object({ khutbaTime: HHMM, prayerTime: HHMM, language: z.string().max(8).nullable().default(null), position: z.number().int().min(0).default(0) });
export type JumuaSlot = z.infer<typeof JumuaSlotSchema>;

export const SpecialPrayerSchema = z.object({ kind: z.enum(["eid_fitr", "eid_adha", "tarawih", "other"]), label: z.string().max(80), date: ISO_DATE, time: HHMM, locationNote: z.string().max(200).nullable().default(null) });
export type SpecialPrayer = z.infer<typeof SpecialPrayerSchema>;

// ---------- Horaires résolus (seule chose lue par les clients) ----------
export const PrayerDaySchema = z.object({
  date: ISO_DATE,
  hijri: z.object({ day: z.number().int(), month: z.number().int(), year: z.number().int(), monthNameAr: z.string(), monthNameFr: z.string() }),
  times: z.object({ fajr: HHMM, shuruq: HHMM, dhuhr: HHMM, asr: HHMM, maghrib: HHMM, isha: HHMM }),
  iqama: z.object({ fajr: HHMM, dhuhr: HHMM, asr: HHMM, maghrib: HHMM, isha: HHMM }),
  source: z.enum(["calculated", "calendar", "override"]),
});
export type PrayerDay = z.infer<typeof PrayerDaySchema>;

// ---------- Mosquée ----------
export const MosqueInputSchema = z.object({
  name: z.string().min(2).max(120),
  nameAr: z.string().max(120).nullable().default(null),
  description: z.string().max(2000).nullable().default(null),
  address: z.string().max(200).nullable().default(null),
  city: z.string().min(1).max(80),
  countryCode: z.string().length(2).default("DJ"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().default("Africa/Djibouti"),
  phone: z.string().max(30).nullable().default(null),
  email: z.string().email().nullable().default(null),
  website: z.string().url().nullable().default(null),
  donationUrl: z.string().url().nullable().default(null),
  services: z.array(z.enum(SERVICES)).default([]),
});
export type MosqueInput = z.infer<typeof MosqueInputSchema>;

export const ScreenSettingsSchema = z.object({
  theme: z.enum(SCREEN_THEMES).default("nuit"),
  languages: z.array(z.enum(["fr", "ar", "en"])).min(1).default(["fr", "ar"]),
  orientation: z.enum(["landscape", "portrait"]).default("landscape"),
  showShuruq: z.boolean().default(true),
  showHadith: z.boolean().default(true),
  showAnnouncements: z.boolean().default(true),
  adhanAudio: z.enum(["none", "beep", "full"]).default("none"),
  prayerScreen: z.enum(["black", "phones_off"]).default("phones_off"),
  durations: z.object({ adhan: z.number().int().min(1).max(10).default(3), iqama: z.number().int().min(1).max(5).default(1), prayer: z.record(z.enum(PRAYERS), z.number().int().min(3).max(40)).default({ fajr: 10, dhuhr: 10, asr: 10, maghrib: 8, isha: 12 }), adhkar: z.number().int().min(0).max(20).default(5) }).default({}),
  slideDurationSec: z.number().int().min(5).max(60).default(9),
});
export type ScreenSettings = z.infer<typeof ScreenSettingsSchema>;

export const AnnouncementInputSchema = z.object({
  type: z.enum(["text", "image", "video"]).default("text"),
  title: z.string().max(120),
  body: z.string().max(1000).nullable().default(null),
  mediaUrl: z.string().url().nullable().default(null),
  startsAt: z.string().datetime().nullable().default(null),
  endsAt: z.string().datetime().nullable().default(null),
  durationSec: z.number().int().min(3).max(120).default(10),
  targets: z.array(z.enum(["screen", "web", "app"])).default(["screen", "web"]),
  isActive: z.boolean().default(true),
});
export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>;

// ---------- Paquet envoyé à l'écran ----------
export interface ScreenBundle {
  version: number;
  generatedAt: string;
  serverTime: string;
  mosque: { id: string; slug: string; name: string; nameAr: string | null; city: string; timezone: string; latitude: number; longitude: number };
  settings: ScreenSettings;
  prayerConfig: PrayerConfig;
  iqamaRules: IqamaRule[];
  jumua: JumuaSlot[];
  specialPrayers: SpecialPrayer[];
  days: PrayerDay[];
  announcements: Array<AnnouncementInput & { id: string }>;
  flashMessage: string | null;
  contentItems: Array<{ id: string; kind: "hadith" | "ayah" | "dua" | "dhikr"; textAr: string; textFr: string | null; textEn: string | null; reference: string | null; context: "after_adhan" | "after_prayer" | "rotation" }>;
}

// ---------- Auth ----------
export const RegisterSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(100), fullName: z.string().min(2).max(100), phone: z.string().max(30).nullable().default(null), locale: z.enum(["fr", "ar", "en"]).default("fr") });
export const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export interface AuthTokens { accessToken: string; refreshToken: string; expiresIn: number }
export interface Me { id: string; email: string; fullName: string; locale: string; isSuperAdmin: boolean; memberships: Array<{ mosqueId: string; role: MemberRole; mosqueName: string; slug: string; status: MosqueStatus }> }

export const HIJRI_MONTHS_AR = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
export const HIJRI_MONTHS_FR = ["Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani", "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'da", "Dhu al-Hijja"];
export const PRAYER_NAMES: Record<TimeKey, { fr: string; ar: string; en: string }> = {
  fajr: { fr: "Fajr", ar: "الفجر", en: "Fajr" }, shuruq: { fr: "Shuruq", ar: "الشروق", en: "Sunrise" }, dhuhr: { fr: "Dhuhr", ar: "الظهر", en: "Dhuhr" },
  asr: { fr: "Asr", ar: "العصر", en: "Asr" }, maghrib: { fr: "Maghrib", ar: "المغرب", en: "Maghrib" }, isha: { fr: "Isha", ar: "العشاء", en: "Isha" },
};
