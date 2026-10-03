/** Barre de commandes cachée (apparaît au mouvement de la souris) : simulation d'état, aperçu des thèmes, plein écran, dissociation. */
import { THEMES, type Labels } from "../labels";
import type { OverlayState } from "./Overlays";

interface Props {
  forced: OverlayState | null;
  onForce: (s: OverlayState | null) => void;
  theme: string;               // thème effectif (bundle ou aperçu local)
  bundleTheme: string;
  onPreviewTheme: (t: string | null) => void;
  onUnpair?: () => void;
  labels: Labels;
}

export function ControlBar({ forced, onForce, theme, bundleTheme, onPreviewTheme, onUnpair, labels }: Props) {
  const states: Array<{ id: OverlayState; label: string }> = [
    { id: "", label: labels.normal }, { id: "adhan", label: labels.stAdhan }, { id: "dua", label: labels.stDua }, { id: "iqama", label: labels.stIqama }, { id: "prayer", label: labels.stPrayer }, { id: "adhkar", label: labels.stAdhkar },
  ];
  const toggleFs = () => {
    const el = document.documentElement;
    const p = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen ? el.requestFullscreen() : Promise.reject();
    p.catch(() => undefined);
  };
  return (
    <div className="demo" role="toolbar" aria-label={labels.simulation}>
      <span className="lbl">{labels.simulation}</span>
      {states.map((s) => (
        <button key={s.id || "normal"} className={(forced ?? "") === s.id && (forced !== null || s.id === "") ? "on" : undefined} onClick={() => onForce(s.id || null)}>{s.label}</button>
      ))}
      <span className="gap" />
      <span className="lbl">{labels.preview}</span>
      {THEMES.map((t) => (
        <button key={t.id} className={`th${theme === t.id ? " on" : ""}`} onClick={() => onPreviewTheme(t.id === bundleTheme ? null : t.id)} title={t.id === bundleTheme ? `${t.label} (${labels.preview})` : `${t.label} — ${labels.preview}`}>
          <i style={{ "--c1": t.c1, "--c2": t.c2 } as React.CSSProperties} />{t.label}
        </button>
      ))}
      <span className="gap" />
      <button onClick={toggleFs}>{labels.fullscreen}</button>
      {onUnpair && <button className="danger" onClick={() => { if (window.confirm(labels.confirmUnpair)) onUnpair(); }}>{labels.unpair}</button>}
    </div>
  );
}
