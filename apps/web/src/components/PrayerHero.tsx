"use client";
import { PRAYER_NAMES, TIMES, type PrayerDay } from "@nidaa/shared";
import { formatHM } from "@nidaa/prayer-engine";
import { countdown, nextPrayer } from "@/lib/next-prayer";
import { useLiveRefresh, useNow } from "./useLive";

interface Props { slug: string; version: number; timezone: string; today: PrayerDay; tomorrow: PrayerDay | null; initialNow: number }

/** Les 6 horaires du jour, la prochaine prière mise en évidence et son compte à rebours, calculés dans le fuseau de la mosquée. */
export function PrayerHero({ slug, version, timezone, today, tomorrow, initialNow }: Props) {
  const now = useNow(initialNow);
  useLiveRefresh(slug, version, today.date, timezone, now);
  const next = nextPrayer(now, timezone, today, tomorrow);
  const name = PRAYER_NAMES[next.prayer];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-line bg-panel px-5 py-5 sm:flex-row sm:items-center sm:px-7">
        <div>
          <p className="eyebrow">{next.phase === "iqama" ? "Iqama dans un instant" : next.tomorrow ? "Prochaine prière · demain" : "Prochaine prière"}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-3xl font-medium sm:text-4xl">
            {name.fr}
            <span lang="ar" dir="rtl" className="font-ar text-gold2">{name.ar}</span>
            <span className="text-xl font-light text-muted tabular-nums sm:text-2xl">{next.phase === "iqama" ? "iqama " : ""}{formatHM(next.at, timezone)}</span>
          </p>
        </div>
        <div className="sm:text-right">
          <p className="eyebrow">{next.phase === "iqama" ? "Iqama dans" : "Adhan dans"}</p>
          <p role="timer" aria-label={`Temps restant avant ${next.phase === "iqama" ? "l'iqama" : "l'adhan"} de ${name.fr}`} className="text-4xl font-light tracking-tight text-gold2 tabular-nums sm:text-5xl">
            {countdown(next.at.getTime() - now.getTime())}
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
        {TIMES.map((k) => {
          const active = !next.tomorrow && k === next.prayer;
          const iqama = k === "shuruq" ? null : today.iqama[k];
          return (
            <li key={k} aria-current={active ? "time" : undefined}
              className={`relative flex flex-col items-center gap-1 px-3 py-5 text-center ${active ? "bg-bg3" : "bg-bg2"}`}>
              {active && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gold" />}
              <span className={`text-sm font-medium uppercase tracking-[.12em] ${active ? "text-gold2" : "text-muted"}`}>{PRAYER_NAMES[k].fr}</span>
              <span lang="ar" dir="rtl" className="font-ar text-lg leading-none text-gold2">{PRAYER_NAMES[k].ar}</span>
              <span className={`mt-1 text-3xl tabular-nums ${active ? "font-medium text-fg" : "font-light text-fg"}`}>{today.times[k]}</span>
              <span className="text-sm text-muted tabular-nums">{iqama ? <>Iqama <span className="text-teal">{iqama}</span></> : "Lever du soleil"}</span>
              {active && <span className="sr-only">Prochaine prière</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
