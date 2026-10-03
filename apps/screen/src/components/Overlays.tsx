/** Les cinq écrans d'état plein écran : adhan, invocation, iqama (grand anneau), prière (noir), adhkar. */
import { useEffect, useState } from "react";
import { PRAYER_NAMES, type Prayer, type ScreenBundle } from "@nidaa/shared";
import { FALLBACK_ADHKAR, FALLBACK_DUA_AFTER_ADHAN, type Labels, type UiLang } from "../labels";

export type OverlayState = "" | "adhan" | "dua" | "iqama" | "prayer" | "adhkar";

interface Props {
  state: OverlayState;
  prayer: Prayer | null;
  bundle: ScreenBundle;
  duaCountdown: string;     // mm:ss avant l'iqama
  iqamaFrac: number;        // 0..1 progression de l'anneau
  labels: Labels; lang: UiLang;
}

const BIG = 289;

export function Overlays({ state, prayer, bundle, duaCountdown, iqamaFrac, labels, lang }: Props) {
  const pick = (c: ScreenBundle["contentItems"][number]) => (lang === "en" ? c.textEn ?? c.textFr : c.textFr ?? c.textEn) ?? "";
  const duaItem = bundle.contentItems.find((c) => c.context === "after_adhan");
  const adhkar = bundle.contentItems.filter((c) => c.context === "after_prayer").map((c) => ({ ar: c.textAr, fr: pick(c) }));
  const list = adhkar.length ? adhkar : FALLBACK_ADHKAR;

  const [ai, setAi] = useState(0);
  useEffect(() => {
    if (state !== "adhkar" || list.length < 2) return;
    const t = setInterval(() => setAi((i) => (i + 1) % list.length), 8000);
    return () => clearInterval(t);
  }, [state, list.length]);
  const cur = list[ai % list.length];
  const name = prayer ? PRAYER_NAMES[prayer][lang] : "";
  const phonesOff = bundle.settings.prayerScreen !== "black";

  return (
    <>
      <div className={`overlay${state === "adhan" ? " on" : ""}`} aria-hidden={state !== "adhan"}>
        <div className="in"><div className="sub">{labels.adhan}</div><div className="big">{name}</div><div className="ar wave" lang="ar">اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ</div></div>
      </div>
      <div className={`overlay${state === "dua" ? " on" : ""}`} aria-hidden={state !== "dua"}>
        <div className="in">
          <div className="sub">{labels.duaAfterAdhan}</div>
          <div className="ar" lang="ar">{duaItem?.textAr ?? FALLBACK_DUA_AFTER_ADHAN}</div>
          {duaItem && pick(duaItem) && <div className="sub" style={{ letterSpacing: 0, maxWidth: "70ch" }}>{pick(duaItem)}</div>}
          <div className="sub">{labels.iqamaInShort}</div><div className="cd">{duaCountdown}</div>
        </div>
      </div>
      <div className={`overlay${state === "iqama" ? " on" : ""}`} aria-hidden={state !== "iqama"}>
        <div className="in">
          <svg className="ring bigring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="tr" cx="50" cy="50" r="46" />
            <circle className="pr" cx="50" cy="50" r="46" strokeDasharray={BIG} strokeDashoffset={BIG * Math.max(0, Math.min(1, iqamaFrac))} />
          </svg>
          <div className="big">{labels.iqamaTitle}</div><div className="ar" lang="ar">قَدْ قَامَتِ الصَّلَاةُ</div><div className="sub">{labels.phonesOff}</div>
        </div>
      </div>
      <div className={`overlay black${state === "prayer" ? " on" : ""}`} aria-hidden={state !== "prayer"}>
        <div className="in">{phonesOff && <div className="sub" style={{ opacity: 0.45 }}>{labels.prayerInProgress}</div>}</div>
      </div>
      <div className={`overlay${state === "adhkar" ? " on" : ""}`} aria-hidden={state !== "adhkar"}>
        <div className="in"><div className="sub">{labels.adhkarAfterPrayer}</div><div className="ar" lang="ar">{cur.ar}</div><div className="sub">{cur.fr}</div></div>
      </div>
    </>
  );
}
