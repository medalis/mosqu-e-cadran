"use client";
import { PRAYER_NAMES, TIMES, type PrayerDay } from "@nidaa/shared";
import { countdown, nextPrayer } from "@/lib/next-prayer";
import { useLiveRefresh, useNow } from "./useLive";

export type EmbedLang = "fr" | "ar" | "en";
const T: Record<EmbedLang, { next: string; iqama: string; tomorrow: string; in: string }> = {
  fr: { next: "Prochaine prière", iqama: "Iqama", tomorrow: "demain", in: "dans" },
  en: { next: "Next prayer", iqama: "Iqama", tomorrow: "tomorrow", in: "in" },
  ar: { next: "الصلاة القادمة", iqama: "الإقامة", tomorrow: "غدًا", in: "بعد" },
};

interface Props { slug: string; version: number; timezone: string; today: PrayerDay; tomorrow: PrayerDay | null; initialNow: number; lang: EmbedLang }

export function EmbedWidget({ slug, version, timezone, today, tomorrow, initialNow, lang }: Props) {
  const now = useNow(initialNow);
  useLiveRefresh(slug, version, today.date, timezone, now);
  const next = nextPrayer(now, timezone, today, tomorrow);
  const t = T[lang];
  const ar = lang === "ar";

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-2">
        <div className="min-w-0">
          <p className={`text-muted ${ar ? "text-sm" : "text-[10px] uppercase tracking-[.14em]"}`}>{next.phase === "iqama" ? t.iqama : t.next}{next.tomorrow ? ` · ${t.tomorrow}` : ""}</p>
          <p className={`truncate font-medium ${ar ? "font-ar text-xl" : "text-lg"}`}>{PRAYER_NAMES[next.prayer][lang]}</p>
        </div>
        <p role="timer" dir="ltr" className="text-2xl font-light text-gold2 tabular-nums">{countdown(next.at.getTime() - now.getTime())}</p>
      </div>
      <ol className="mt-2 grid grid-cols-3 gap-1.5 min-[400px]:grid-cols-6">
        {TIMES.map((k) => {
          const active = !next.tomorrow && k === next.prayer;
          return (
            <li key={k} aria-current={active ? "time" : undefined} className={`flex flex-col items-center rounded-lg border px-1 py-1.5 text-center ${active ? "border-gold bg-panel2" : "border-line bg-panel"}`}>
              <span className={`${ar ? "font-ar text-sm" : "text-[11px]"} ${active ? "text-gold2" : "text-muted"}`}>{PRAYER_NAMES[k][lang]}</span>
              <span dir="ltr" className="text-base font-medium tabular-nums">{today.times[k]}</span>
              <span dir="ltr" className="text-[11px] text-teal tabular-nums">{k === "shuruq" ? " " : today.iqama[k]}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
