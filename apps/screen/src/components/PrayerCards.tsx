import { PRAYER_NAMES, type Prayer, type TimeKey } from "@nidaa/shared";
import type { DayModel } from "../model";
import type { Labels, UiLang } from "../labels";

interface Props { model: DayModel; order: TimeKey[]; highlight: TimeKey | null; isPast: (k: TimeKey) => boolean; labels: Labels; lang: UiLang }

export function PrayerCards({ model, order, highlight, isPast, labels, lang }: Props) {
  const d = model.today;
  return (
    <div className="prayers" style={order.length !== 6 ? { gridTemplateColumns: `repeat(${order.length},1fr)` } : undefined}>
      {order.map((k) => (
        <div key={k} className={`card${highlight === k ? " now" : isPast(k) ? " past" : ""}`}>
          <div className="n">{PRAYER_NAMES[k][lang]}</div>
          <div className="ar" lang="ar">{PRAYER_NAMES[k].ar}</div>
          <div className="t">{d.times[k]}</div>
          <div className="iq">{k === "shuruq" ? labels.sunrise : <>{labels.iqama} <b>{d.iqama[k as Prayer]}</b></>}</div>
        </div>
      ))}
    </div>
  );
}
