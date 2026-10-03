/** Tuile Jumu'a + tuile de rotation (annonces écran actives, hadiths et versets) avec points de progression. */
import { useEffect, useMemo, useState } from "react";
import type { ScreenBundle } from "@nidaa/shared";
import type { Labels, UiLang } from "../labels";

export interface RotItem { id: string; k: string; ar?: string; text?: string; src?: string; img?: string; durationSec: number }

interface Props { bundle: ScreenBundle; now: Date; labels: Labels; lang: UiLang }

export function rotationItems(bundle: ScreenBundle, now: Date, labels: Labels, lang: UiLang): RotItem[] {
  const out: RotItem[] = [];
  const n = now.getTime();
  if (bundle.settings.showAnnouncements) {
    for (const a of bundle.announcements) {
      if (!a.isActive || !a.targets?.includes("screen")) continue;
      if (a.startsAt && new Date(a.startsAt).getTime() > n) continue;
      if (a.endsAt && new Date(a.endsAt).getTime() < n) continue;
      out.push({ id: `a-${a.id}`, k: `${labels.announcement} · ${a.title}`, text: a.body ?? (a.type === "text" ? a.title : undefined), img: a.type === "image" && a.mediaUrl ? a.mediaUrl : undefined, durationSec: a.durationSec ?? bundle.settings.slideDurationSec });
    }
  }
  if (bundle.settings.showHadith) {
    const kindLabel = { hadith: labels.hadith, ayah: labels.ayah, dua: labels.dua, dhikr: labels.dhikr } as const;
    for (const c of bundle.contentItems) {
      if (c.context !== "rotation") continue;
      const text = (lang === "en" ? c.textEn ?? c.textFr : c.textFr ?? c.textEn) ?? undefined;
      out.push({ id: `c-${c.id}`, k: kindLabel[c.kind], ar: c.textAr, text, src: c.reference ?? undefined, durationSec: bundle.settings.slideDurationSec });
    }
  }
  // Alterner annonces et contenus pour un défilement varié.
  const ann = out.filter((x) => x.id.startsWith("a-")), cont = out.filter((x) => x.id.startsWith("c-"));
  const mixed: RotItem[] = [];
  const L = Math.max(ann.length, cont.length);
  for (let i = 0; i < L; i++) { if (ann[i]) mixed.push(ann[i]); if (cont[i]) mixed.push(cont[i]); }
  return mixed;
}

export function Tiles({ bundle, now, labels, lang }: Props) {
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const items = useMemo(() => rotationItems(bundle, new Date(minuteKey * 60_000), labels, lang), [bundle, minuteKey, labels, lang]);
  const [idx, setIdx] = useState(0);
  const count = items.length;
  const safeIdx = count ? idx % count : 0;

  useEffect(() => {
    if (count < 2) return;
    const cur = items[safeIdx];
    const t = setTimeout(() => setIdx((i) => (i + 1) % count), Math.max(3, cur?.durationSec ?? bundle.settings.slideDurationSec) * 1000);
    return () => clearTimeout(t);
  }, [items, safeIdx, count, bundle.settings.slideDurationSec]);

  const jumua = [...bundle.jumua].sort((a, b) => a.position - b.position);
  return (
    <section className="lower">
      <div className="tile">
        <div className="k">{labels.jumua}</div>
        {jumua.length === 0 ? (
          <div className="v">{labels.none}</div>
        ) : (
          jumua.map((j, i) => (
            <div className="v" key={i}>{labels.khutba} <b>{j.khutbaTime}</b> · {labels.prayer} <b>{j.prayerTime}</b>{j.language && jumua.length > 1 ? <span style={{ color: "var(--muted)", fontSize: ".75em" }}> · {j.language.toUpperCase()}</span> : null}</div>
          ))
        )}
      </div>
      <div className="tile">
        {count > 1 && (
          <div className="dots">{items.map((it, i) => <i key={it.id} className={i === safeIdx ? "on" : undefined} />)}</div>
        )}
        {count === 0 ? (
          <div className="rot on"><div className="k">{labels.info}</div><div className="v">{labels.noContent}</div></div>
        ) : (
          items.map((it, i) => (
            <div key={it.id} className={`rot${i === safeIdx ? " on" : ""}`}>
              <div className="k">{it.k}</div>
              {it.img && <img src={it.img} alt="" />}
              {it.ar && <div className="ar" lang="ar">{it.ar}</div>}
              {it.text && <div className="v">{it.text}</div>}
              {it.src && <div className="src">{it.src}</div>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
