/** Bundle de démonstration « Mosquée Al-Rahma » (Djibouti) : utilisé en mode aperçu quand l'API est injoignable. */
import { resolveRange, toIsoDate } from "@nidaa/prayer-engine";
import { PrayerConfigSchema, ScreenSettingsSchema, type IqamaRule, type PrayerConfig, type PrayerDay, type ScreenBundle, type ScreenSettings } from "@nidaa/shared";

export const DEMO_MOSQUE: ScreenBundle["mosque"] = { id: "demo", slug: "al-rahma", name: "Mosquée Al-Rahma", nameAr: "مسجد الرحمة", city: "Djibouti", timezone: "Africa/Djibouti", latitude: 11.588, longitude: 43.145 };
export const DEMO_PRAYER_CONFIG: PrayerConfig = PrayerConfigSchema.parse({ method: "MWL", adjustments: { fajr: 2, maghrib: 3 } });
export const DEMO_IQAMA_RULES: IqamaRule[] = [
  { prayer: "fajr", mode: "delay", delayMin: 20, fixedTime: null },
  { prayer: "dhuhr", mode: "delay", delayMin: 15, fixedTime: null },
  { prayer: "asr", mode: "delay", delayMin: 15, fixedTime: null },
  { prayer: "maghrib", mode: "delay", delayMin: 5, fixedTime: null },
  { prayer: "isha", mode: "delay", delayMin: 15, fixedTime: null },
];
export const DEFAULT_SETTINGS: ScreenSettings = ScreenSettingsSchema.parse({});

const DEMO_CONTENT: ScreenBundle["contentItems"] = [
  { id: "h1", kind: "hadith", textAr: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", textFr: "Les actes ne valent que par leurs intentions.", textEn: "Actions are judged by intentions.", reference: "Al-Bukhari, Muslim", context: "rotation" },
  { id: "a1", kind: "ayah", textAr: "وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ وَارْكَعُوا مَعَ الرَّاكِعِينَ", textFr: "Accomplissez la prière, acquittez la zakat et inclinez-vous avec ceux qui s'inclinent.", textEn: "Establish prayer, give zakah and bow with those who bow.", reference: "Al-Baqara, 43", context: "rotation" },
  { id: "d1", kind: "dua", textAr: "اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ", textFr: "Ô Allah, Seigneur de cet appel parfait et de cette prière établie, accorde à Muhammad al-wasila et al-fadila.", textEn: null, reference: null, context: "after_adhan" },
  { id: "z1", kind: "dhikr", textAr: "أَسْتَغْفِرُ اللَّهَ · أَسْتَغْفِرُ اللَّهَ · أَسْتَغْفِرُ اللَّهَ", textFr: "Astaghfirullah ×3", textEn: "Astaghfirullah ×3", reference: null, context: "after_prayer" },
  { id: "z2", kind: "dhikr", textAr: "اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ", textFr: "Allahumma anta as-salam wa minka as-salam", textEn: "Allahumma anta as-salam wa minka as-salam", reference: null, context: "after_prayer" },
  { id: "z3", kind: "dhikr", textAr: "سُبْحَانَ اللَّهِ ×33 · الْحَمْدُ لِلَّهِ ×33 · اللَّهُ أَكْبَرُ ×34", textFr: "Subhan Allah · Al-hamdu lillah · Allahu akbar", textEn: "Subhan Allah · Al-hamdu lillah · Allahu akbar", reference: null, context: "after_prayer" },
];

/** Jours résolus localement avec le moteur partagé, d'hier à +days. */
export function computeDays(mosque: ScreenBundle["mosque"], config: PrayerConfig, iqamaRules: IqamaRule[], fromIso: string, days: number): PrayerDay[] {
  return resolveRange({ latitude: mosque.latitude, longitude: mosque.longitude, timezone: mosque.timezone, config, iqamaRules }, fromIso, days);
}

const shiftIso = (iso: string, deltaDays: number) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12)); return dt.toISOString().slice(0, 10); };

export function buildDemoBundle(now = new Date()): ScreenBundle {
  const today = toIsoDate(now, DEMO_MOSQUE.timezone);
  const from = shiftIso(today, -1);
  return {
    version: 0,
    generatedAt: now.toISOString(),
    serverTime: now.toISOString(),
    mosque: DEMO_MOSQUE,
    settings: DEFAULT_SETTINGS,
    prayerConfig: DEMO_PRAYER_CONFIG,
    iqamaRules: DEMO_IQAMA_RULES,
    jumua: [{ khutbaTime: "12:00", prayerTime: "12:30", language: "ar", position: 0 }],
    specialPrayers: [],
    days: computeDays(DEMO_MOSQUE, DEMO_PRAYER_CONFIG, DEMO_IQAMA_RULES, from, 60),
    announcements: [
      { id: "an1", type: "text", title: "Cours de tajwid", body: "Cours de tajwid chaque samedi après Maghrib, ouvert à tous.", mediaUrl: null, startsAt: null, endsAt: null, durationSec: 10, targets: ["screen", "web"], isActive: true },
      { id: "an2", type: "text", title: "Collecte", body: "Collecte pour la rénovation de la salle d'ablutions : scannez le code au fond de la salle.", mediaUrl: null, startsAt: null, endsAt: null, durationSec: 10, targets: ["screen", "web"], isActive: true },
    ],
    flashMessage: "Merci d'éteindre vos téléphones avant la prière · Cours de tajwid chaque samedi après Maghrib · Collecte pour la rénovation de la salle d'ablutions",
    contentItems: DEMO_CONTENT,
  };
}
