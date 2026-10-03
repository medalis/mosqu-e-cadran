import type { PrayerDay, ScreenBundle } from "@nidaa/shared";
import { Logo } from "./Logo";
import type { UiLang } from "../labels";

interface Props { mosque: ScreenBundle["mosque"]; now: Date; day: PrayerDay | undefined; lang: UiLang; subtitle?: string }

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function gregFormatter(lang: UiLang, tz: string) {
  const key = `${lang}|${tz}`;
  let f = fmtCache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }); fmtCache.set(key, f); }
  return f;
}

export function Header({ mosque, now, day, lang, subtitle }: Props) {
  const g = gregFormatter(lang, mosque.timezone).format(now);
  const greg = g.charAt(0).toUpperCase() + g.slice(1);
  const hijri = day ? `${day.hijri.day} ${day.hijri.monthNameAr} ${day.hijri.year}` : "";
  return (
    <header>
      <div className="brand">
        <Logo />
        <div>
          {mosque.nameAr && <div className="name-ar" lang="ar" dir="rtl">{mosque.nameAr}</div>}
          <div className="name">{mosque.name}</div>
          <div className="city">{mosque.city}{subtitle ? ` · ${subtitle}` : ""}</div>
        </div>
      </div>
      <div className="dates">
        <div className="greg">{greg}</div>
        <div className="hijri" lang="ar" dir="rtl" title={day ? `${day.hijri.day} ${day.hijri.monthNameFr} ${day.hijri.year}` : undefined}>{hijri}</div>
      </div>
    </header>
  );
}
