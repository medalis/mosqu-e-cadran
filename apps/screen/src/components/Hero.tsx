import { partsIn } from "@nidaa/prayer-engine";
import type { Labels } from "../labels";

export interface PillInfo { label: string; name: string; nameAr: string; toLabel: string; countdown: string; frac: number }

interface Props { now: Date; timezone: string; pill: PillInfo | null; labels: Labels }

const pad = (n: number) => String(n).padStart(2, "0");
const RING_LEN = 125.6;

export function Hero({ now, timezone, pill, labels }: Props) {
  const p = partsIn(now, timezone);
  return (
    <section className="hero">
      <div className="clock" aria-live="off">
        <span>{pad(p.hour)}</span><span className="colon">:</span><span>{pad(p.minute)}</span><small>{pad(p.second)}</small>
      </div>
      <div className="nextline">
        <svg className="ring" viewBox="0 0 48 48" aria-hidden="true">
          <circle className="tr" cx="24" cy="24" r="20" />
          <circle className="pr" cx="24" cy="24" r="20" strokeDasharray={RING_LEN} strokeDashoffset={RING_LEN * (1 - Math.max(0, Math.min(1, pill?.frac ?? 0)))} />
        </svg>
        <span className="lbl">{pill?.label ?? labels.nextPrayer}</span>
        <span className="nm"><span>{pill?.name ?? "—"}</span><span className="ar" lang="ar">{pill?.nameAr ?? ""}</span></span>
        <span className="sep" />
        <span className="lbl">{pill?.toLabel ?? labels.adhanIn}</span>
        <span className="cd">{pill?.countdown ?? "--:--:--"}</span>
      </div>
    </section>
  );
}
