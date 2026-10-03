/** Arc du jour : 6 repères alignés sur les cartes ; le soleil glisse d'un repère au suivant selon l'heure. */
import { useEffect, useRef, useState } from "react";
import type { TimeKey } from "@nidaa/shared";
import type { DayModel } from "../model";

interface Props { model: DayModel; now: Date; order: TimeKey[]; highlight: TimeKey | null; isPast: (k: TimeKey) => boolean }

export function DayArc({ model, now, order, highlight, isPast }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ W: 1200, H: 120 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 10) setSize({ W: Math.round(r.width), H: Math.round(r.height) }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { W, H } = size;
  const N = order.length;
  const ax = (i: number) => (i + 0.5) * W / N;
  const ay = (x: number) => H - 12 - (H - 26) * Math.sin(Math.PI * (x / W));
  let path = "";
  for (let x = 0; x <= W; x += 10) path += (x ? "L" : "M") + x + " " + ay(x).toFixed(1) + " ";
  if ((W % 10) !== 0) path += "L" + W + " " + ay(W).toFixed(1);

  const last = N - 1;
  const t = order.map((k) => model.at[k].getTime());
  const n = now.getTime();
  let sx: number;
  if (n <= t[0]) { const s = model.prevIsha.getTime(); sx = ax(0) * Math.max(0, Math.min(1, (n - s) / (t[0] - s))); }
  else if (n >= t[last]) { const e = model.fajrTomorrow.getTime(); sx = ax(last) + (W - ax(last)) * Math.max(0, Math.min(1, (n - t[last]) / (e - t[last]))); }
  else { sx = ax(last); for (let i = 0; i < last; i++) if (n < t[i + 1]) { sx = ax(i) + (ax(i + 1) - ax(i)) * (n - t[i]) / (t[i + 1] - t[i]); break; } }
  const sy = ay(sx);

  return (
    <svg ref={ref} className="arc" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path className="path" d={path} />
      <path className="done" d={path} pathLength={1000} style={{ strokeDashoffset: 1000 - 1000 * (sx / W) }} />
      {order.map((k, i) => (
        <circle key={k} className={`pt${highlight === k ? " now" : isPast(k) ? " past" : ""}`} cx={ax(i)} cy={ay(ax(i)).toFixed(1)} r="5" />
      ))}
      <circle className="sunhalo" cx={sx} cy={sy} r="14" />
      <circle className="sun" cx={sx} cy={sy} r="7" />
    </svg>
  );
}
