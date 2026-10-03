/**
 * Jeu de données de démonstration (CONTRACT.md « Comptes de démonstration »). Idempotent : relançable sans doublon.
 *   pnpm --filter @nidaa/api prisma:seed
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgPoolConfig } from "../src/prisma/pg-config";
import * as argon2 from "argon2";
import { PrayerConfigSchema, ScreenSettingsSchema, type IqamaRule } from "@nidaa/shared";
import { resolveRange, toIsoDate } from "@nidaa/prayer-engine";
import { seedContentLibrary } from "./content-library";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");
const prisma = new PrismaClient({ adapter: new PrismaPg(pgPoolConfig()) });

const PASSWORD = "Nidaa2026!";

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);

  // ----- utilisateurs -----
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@nidaa.dj" },
    update: { isSuperAdmin: true },
    create: { email: "admin@nidaa.dj", passwordHash, fullName: "Administrateur Nidaa", locale: "fr", isSuperAdmin: true, emailVerifiedAt: new Date() },
  });
  const imam = await prisma.user.upsert({
    where: { email: "imam@al-rahma.dj" },
    update: {},
    create: { email: "imam@al-rahma.dj", passwordHash, fullName: "Imam Abdourahman", locale: "fr", phone: "+253 77 00 00 00", emailVerifiedAt: new Date() },
  });

  // ----- mosquée -----
  const mosque = await prisma.mosque.upsert({
    where: { slug: "al-rahma" },
    update: { status: "published", validatedBy: superAdmin.id, validatedAt: new Date() },
    create: {
      slug: "al-rahma",
      name: "Mosquée Al-Rahma",
      nameAr: "مسجد الرحمة",
      description: "Mosquée de quartier à Djibouti-ville : cinq prières quotidiennes, Jumu'a, cours de Coran pour les enfants le week-end.",
      address: "Avenue 13, Quartier 7",
      city: "Djibouti",
      countryCode: "DJ",
      latitude: 11.588,
      longitude: 43.145,
      timezone: "Africa/Djibouti",
      phone: "+253 21 00 00 00",
      email: "contact@al-rahma.dj",
      donationUrl: "https://example.org/don/al-rahma",
      services: ["women_space", "ablutions", "parking", "quran_school", "classes"],
      status: "published",
      validatedBy: superAdmin.id,
      validatedAt: new Date(),
    },
  });

  await prisma.mosqueMember.upsert({
    where: { mosqueId_userId: { mosqueId: mosque.id, userId: imam.id } },
    update: { role: "owner" },
    create: { mosqueId: mosque.id, userId: imam.id, role: "owner", acceptedAt: new Date() },
  });

  // ----- configuration des horaires : MWL, ajustements fajr +2 / maghrib +3 -----
  const config = PrayerConfigSchema.parse({ method: "MWL", adjustments: { fajr: 2, maghrib: 3 } });
  await prisma.prayerConfig.upsert({ where: { mosqueId: mosque.id }, update: { ...config }, create: { mosqueId: mosque.id, ...config } });

  // ----- iqama 20/15/15/5/15 (délai après l'adhan) -----
  const iqamaRules: IqamaRule[] = [
    { prayer: "fajr", mode: "delay", delayMin: 20, fixedTime: null },
    { prayer: "dhuhr", mode: "delay", delayMin: 15, fixedTime: null },
    { prayer: "asr", mode: "delay", delayMin: 15, fixedTime: null },
    { prayer: "maghrib", mode: "delay", delayMin: 5, fixedTime: null },
    { prayer: "isha", mode: "delay", delayMin: 15, fixedTime: null },
  ];
  await prisma.$transaction([
    prisma.iqamaRule.deleteMany({ where: { mosqueId: mosque.id } }),
    prisma.iqamaRule.createMany({ data: iqamaRules.map((r) => ({ mosqueId: mosque.id, prayer: r.prayer, mode: r.mode, delayMin: r.delayMin, fixedTime: r.fixedTime })) }),
  ]);

  // ----- Jumu'a -----
  await prisma.$transaction([
    prisma.jumuaSlot.deleteMany({ where: { mosqueId: mosque.id } }),
    prisma.jumuaSlot.create({ data: { mosqueId: mosque.id, khutbaTime: "12:00", prayerTime: "12:30", language: "ar", position: 0 } }),
  ]);

  // ----- écran -----
  const settings = ScreenSettingsSchema.parse({ theme: "nuit", languages: ["fr", "ar"] });
  await prisma.screenSettings.upsert({ where: { mosqueId: mosque.id }, update: { settings }, create: { mosqueId: mosque.id, settings } });

  // ----- annonces -----
  const announcements = [
    { title: "Cours de tajwid pour les jeunes", body: "Chaque samedi et dimanche de 16h à 17h30 — inscriptions auprès du secrétariat de la mosquée.", durationSec: 12, targets: ["screen", "web"], position: 0 },
    { title: "Collecte pour l'entretien de la salle d'ablutions", body: "Participez aux travaux de rénovation. Un reçu est remis pour chaque don. Qu'Allah vous récompense.", durationSec: 10, targets: ["screen", "web", "app"], position: 1 },
  ];
  for (const a of announcements) {
    const existing = await prisma.announcement.findFirst({ where: { mosqueId: mosque.id, title: a.title } });
    if (existing) await prisma.announcement.update({ where: { id: existing.id }, data: { ...a, type: "text", isActive: true } });
    else await prisma.announcement.create({ data: { mosqueId: mosque.id, type: "text", isActive: true, ...a } });
  }

  // ----- message flash -----
  await prisma.flashMessage.upsert({
    where: { mosqueId: mosque.id },
    update: { text: "Merci de mettre vos téléphones en mode silencieux pendant la prière — جزاكم الله خيرا", isActive: true },
    create: { mosqueId: mosque.id, text: "Merci de mettre vos téléphones en mode silencieux pendant la prière — جزاكم الله خيرا", isActive: true },
  });

  // ----- bibliothèque de contenus (plateforme) -----
  await seedContentLibrary(prisma);

  // ----- horaires résolus : 400 jours à partir d'hier -----
  const today = toIsoDate(new Date(), mosque.timezone);
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1, 12));
  const from = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
  const days = resolveRange({ latitude: mosque.latitude, longitude: mosque.longitude, timezone: mosque.timezone, config, iqamaRules }, from, 400);
  await prisma.$transaction([
    prisma.prayerDay.deleteMany({ where: { mosqueId: mosque.id, source: { not: "override" } } }),
    prisma.prayerDay.createMany({
      data: days.map((pd) => ({
        mosqueId: mosque.id, date: pd.date, source: pd.source,
        fajr: pd.times.fajr, shuruq: pd.times.shuruq, dhuhr: pd.times.dhuhr, asr: pd.times.asr, maghrib: pd.times.maghrib, isha: pd.times.isha,
        iqamaFajr: pd.iqama.fajr, iqamaDhuhr: pd.iqama.dhuhr, iqamaAsr: pd.iqama.asr, iqamaMaghrib: pd.iqama.maghrib, iqamaIsha: pd.iqama.isha,
        hijriDay: pd.hijri.day, hijriMonth: pd.hijri.month, hijriYear: pd.hijri.year,
      })),
      skipDuplicates: true,
    }),
  ]);

  await prisma.mosque.update({ where: { id: mosque.id }, data: { version: { increment: 1 } } });

  console.log(`Seed OK — mosquée ${mosque.name} (${mosque.slug}), ${days.length} jours résolus à partir du ${from}.`);
  console.log(`  Super-admin : admin@nidaa.dj / ${PASSWORD}`);
  console.log(`  Responsable : imam@al-rahma.dj / ${PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
