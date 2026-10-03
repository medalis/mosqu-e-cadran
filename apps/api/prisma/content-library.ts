/**
 * Bibliothèque de contenus de la plateforme (hadiths, versets, invocations affichés par les écrans).
 * Partagée par le jeu de démonstration (seed.ts) et l'initialisation de production (seed-content.ts). Idempotent.
 */
import type { PrismaClient } from "@prisma/client";

export const CONTENT_LIBRARY = [
  {
    kind: "hadith", context: "rotation",
    textAr: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
    textFr: "Les actes ne valent que par les intentions, et à chacun selon son intention.",
    textEn: "Actions are judged by intentions, and every person will be rewarded according to what they intended.",
    reference: "Sahih al-Bukhari 1, Sahih Muslim 1907",
  },
  {
    kind: "hadith", context: "rotation",
    textAr: "لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    textFr: "Aucun de vous ne croit véritablement tant qu'il n'aime pas pour son frère ce qu'il aime pour lui-même.",
    textEn: "None of you truly believes until he loves for his brother what he loves for himself.",
    reference: "Sahih al-Bukhari 13, Sahih Muslim 45",
  },
  {
    kind: "ayah", context: "rotation",
    textAr: "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا",
    textFr: "Certes, la prière demeure, pour les croyants, une prescription à des temps déterminés.",
    textEn: "Indeed, prayer has been decreed upon the believers a decree of specified times.",
    reference: "Coran 4:103",
  },
  {
    kind: "ayah", context: "rotation",
    textAr: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
    textFr: "N'est-ce point par l'évocation d'Allah que se tranquillisent les cœurs ?",
    textEn: "Verily, in the remembrance of Allah do hearts find rest.",
    reference: "Coran 13:28",
  },
  {
    kind: "dua", context: "after_adhan",
    textAr: "اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلاَةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ",
    textFr: "Ô Allah, Seigneur de cet appel parfait et de cette prière qui va être accomplie, accorde à Muhammad al-Wasila et al-Fadila, et élève-le au rang louable que Tu lui as promis.",
    textEn: "O Allah, Lord of this perfect call and established prayer, grant Muhammad al-Wasilah and al-Fadilah, and raise him to the praised station You have promised him.",
    reference: "Sahih al-Bukhari 614",
  },
  {
    kind: "dhikr", context: "after_prayer",
    textAr: "أَسْتَغْفِرُ اللَّهَ (ثلاثًا) — اللَّهُمَّ أَنْتَ السَّلاَمُ وَمِنْكَ السَّلاَمُ، تَبَارَكْتَ يَا ذَا الْجَلاَلِ وَالإِكْرَامِ",
    textFr: "Je demande pardon à Allah (3 fois). Ô Allah, Tu es la Paix et de Toi vient la paix ; béni sois-Tu, ô Détenteur de la majesté et de la générosité.",
    textEn: "I seek Allah's forgiveness (3 times). O Allah, You are Peace and from You comes peace; blessed are You, O Owner of majesty and honour.",
    reference: "Sahih Muslim 591",
  },
] as const;

export async function seedContentLibrary(prisma: PrismaClient): Promise<number> {
  for (const c of CONTENT_LIBRARY) {
    const existing = await prisma.contentItem.findFirst({ where: { textAr: c.textAr } });
    if (existing) await prisma.contentItem.update({ where: { id: existing.id }, data: { ...c, isActive: true } });
    else await prisma.contentItem.create({ data: { ...c, isActive: true } });
  }
  return CONTENT_LIBRARY.length;
}
