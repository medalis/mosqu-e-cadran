/** Libellés de l'interface (fr par défaut ; en si « fr » absent des langues de l'écran). Les noms arabes viennent de PRAYER_NAMES. */
import type { ScreenSettings } from "@nidaa/shared";

export type UiLang = "fr" | "en";

export function uiLangOf(settings: ScreenSettings | undefined): UiLang {
  const langs = settings?.languages ?? ["fr", "ar"];
  if (!langs.includes("fr") && langs.includes("en")) return "en";
  return "fr";
}

const FR = {
  nextPrayer: "Prochaine prière", inProgress: "En cours", adhanIn: "adhan dans", iqamaIn: "iqama dans", iqama: "iqama", sunrise: "lever du soleil",
  jumua: "Jumu'a · الجمعة", khutba: "Prêche", prayer: "Prière", none: "—", info: "Info", announcement: "Annonce", hadith: "Hadith", ayah: "Verset", dua: "Invocation", dhikr: "Dhikr",
  adhan: "Adhan · الأذان", duaAfterAdhan: "Invocation après l'adhan", iqamaInShort: "Iqama dans", iqamaTitle: "Iqama", phonesOff: "Merci d'éteindre vos téléphones",
  prayerInProgress: "Prière en cours · éteignez vos téléphones", adhkarAfterPrayer: "Adhkar après la prière",
  offline: "hors ligne", online: "synchronisé",
  pairTitle: "Associer cet écran", pairHint: "Dans le back-office Nidaa, ouvrez", pairHintPath: "Écrans → Associer un écran", pairHintEnd: "et saisissez ce code.",
  waiting: "En attente d'association", requesting: "Demande d'un code…", expiresIn: "Code valable encore", newCode: "Nouveau code", retry: "Réessayer",
  pairError: "Impossible de joindre le serveur Nidaa. Vérifiez la connexion internet de l'écran, puis réessayez.", expired: "Le code a expiré.", loading: "Chargement…", pairedLoading: "Écran associé · chargement des horaires…",
  simulation: "Simulation", preview: "aperçu", fullscreen: "Plein écran", unpair: "Dissocier l'écran", confirmUnpair: "Dissocier cet écran de la mosquée ? Il faudra le réassocier avec un nouveau code.",
  audioHint: "Cliquez une fois sur l'écran pour autoriser le son de l'adhan", normal: "Normal", stAdhan: "Adhan", stDua: "Après adhan", stIqama: "Iqama", stPrayer: "Prière", stAdhkar: "Adhkar",
  demoCity: "exemple", noContent: "Bienvenue à la mosquée",
};
const EN: typeof FR = {
  nextPrayer: "Next prayer", inProgress: "In progress", adhanIn: "adhan in", iqamaIn: "iqama in", iqama: "iqama", sunrise: "sunrise",
  jumua: "Jumu'a · الجمعة", khutba: "Khutba", prayer: "Prayer", none: "—", info: "Info", announcement: "Announcement", hadith: "Hadith", ayah: "Verse", dua: "Supplication", dhikr: "Dhikr",
  adhan: "Adhan · الأذان", duaAfterAdhan: "Supplication after the adhan", iqamaInShort: "Iqama in", iqamaTitle: "Iqama", phonesOff: "Please switch off your phones",
  prayerInProgress: "Prayer in progress · switch off your phones", adhkarAfterPrayer: "Adhkar after the prayer",
  offline: "offline", online: "synced",
  pairTitle: "Pair this screen", pairHint: "In the Nidaa back-office, open", pairHintPath: "Screens → Pair a screen", pairHintEnd: "and enter this code.",
  waiting: "Waiting for pairing", requesting: "Requesting a code…", expiresIn: "Code valid for", newCode: "New code", retry: "Retry",
  pairError: "Cannot reach the Nidaa server. Check the screen's internet connection and try again.", expired: "The code has expired.", loading: "Loading…", pairedLoading: "Screen paired · loading prayer times…",
  simulation: "Simulation", preview: "preview", fullscreen: "Fullscreen", unpair: "Unpair screen", confirmUnpair: "Unpair this screen from the mosque? You will need a new code to pair it again.",
  audioHint: "Click once on the screen to enable the adhan sound", normal: "Normal", stAdhan: "Adhan", stDua: "After adhan", stIqama: "Iqama", stPrayer: "Prayer", stAdhkar: "Adhkar",
  demoCity: "example", noContent: "Welcome to the mosque",
};

export type Labels = typeof FR;
export const labelsFor = (lang: UiLang): Labels => (lang === "en" ? EN : FR);

export const THEMES: Array<{ id: string; label: string; c1: string; c2: string }> = [
  { id: "nuit", label: "Nuit", c1: "#0e1529", c2: "#d8b46a" },
  { id: "emeraude", label: "Émeraude", c1: "#0b2119", c2: "#7bd7a2" },
  { id: "bordeaux", label: "Bordeaux", c1: "#220b10", c2: "#dcb46d" },
  { id: "ottoman", label: "Ottoman", c1: "#0a2340", c2: "#5fd3e6" },
  { id: "sable", label: "Sable", c1: "#241a10", c2: "#e0b26a" },
  { id: "ivoire", label: "Ivoire", c1: "#ece4d3", c2: "#9a7a2f" },
];

/** Textes de secours du prototype quand le bundle ne fournit pas de contenu. */
export const FALLBACK_DUA_AFTER_ADHAN = "اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ";
export const FALLBACK_ADHKAR: Array<{ ar: string; fr: string }> = [
  { ar: "أَسْتَغْفِرُ اللَّهَ · أَسْتَغْفِرُ اللَّهَ · أَسْتَغْفِرُ اللَّهَ", fr: "Astaghfirullah ×3" },
  { ar: "اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ", fr: "Allahumma anta as-salam wa minka as-salam" },
  { ar: "سُبْحَانَ اللَّهِ ×33 · الْحَمْدُ لِلَّهِ ×33 · اللَّهُ أَكْبَرُ ×34", fr: "Subhan Allah · Al-hamdu lillah · Allahu akbar" },
];
