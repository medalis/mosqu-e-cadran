/** Écran d'appairage : demande un code, l'affiche en très grand, sonde le serveur toutes les 3 s. */
import { useCallback, useEffect, useRef, useState } from "react";
import { pollPairing, startPairing, API_URL } from "../api";
import { loadPairing, savePairing, type PairingSession } from "../store";
import { Logo } from "./Logo";
import type { Labels } from "../labels";

interface Props { onPaired: (deviceToken: string) => void; labels: Labels }

type Phase = { kind: "requesting" } | { kind: "waiting"; session: PairingSession } | { kind: "paired" } | { kind: "error"; message: string };

const POLL_MS = 3000;

export function Pairing({ onPaired, labels }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "requesting" });
  const [now, setNow] = useState(Date.now());
  const alive = useRef(true);

  const requestCode = useCallback(async () => {
    setPhase({ kind: "requesting" });
    try {
      const s = await startPairing();
      if (!alive.current) return;
      await savePairing(s);
      setPhase({ kind: "waiting", session: s });
    } catch (e) {
      if (!alive.current) return;
      setPhase({ kind: "error", message: e instanceof Error && e.message && !/fetch|abort|network/i.test(e.message) ? `${labels.pairError} (${e.message})` : labels.pairError });
    }
  }, [labels]);

  // Démarrage : réutiliser un code encore valable, sinon en demander un.
  useEffect(() => {
    alive.current = true;
    (async () => {
      const saved = await loadPairing();
      if (saved && new Date(saved.expiresAt).getTime() > Date.now() + 30_000) setPhase({ kind: "waiting", session: saved });
      else void requestCode();
    })();
    return () => { alive.current = false; };
  }, [requestCode]);

  // Sondage.
  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const { session } = phase;
    let cancelled = false;
    let failures = 0;
    const tick = async () => {
      if (cancelled) return;
      if (new Date(session.expiresAt).getTime() <= Date.now()) { await savePairing(null); void requestCode(); return; }
      try {
        const r = await pollPairing(session.code, session.pollToken);
        failures = 0;
        if (cancelled) return;
        if (r.status === "paired") { await savePairing(null); setPhase({ kind: "paired" }); onPaired(r.deviceToken); return; }
      } catch (e) {
        failures++;
        // Code inconnu/expiré côté serveur → nouveau code ; serveur injoignable → on continue à sonder, en le signalant.
        const status = (e as { status?: number }).status;
        if (status === 404 || status === 410) { await savePairing(null); void requestCode(); return; }
        if (failures >= 5) { setPhase({ kind: "error", message: labels.pairError }); return; }
      }
      timer = setTimeout(tick, POLL_MS);
    };
    let timer = setTimeout(tick, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(clock); };
  }, [phase, onPaired, requestCode, labels]);

  const remaining = phase.kind === "waiting" ? Math.max(0, Math.floor((new Date(phase.session.expiresAt).getTime() - now) / 1000)) : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0"), ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="pairing">
      <div className="in">
        <Logo className="logo" />
        <div className="title"><b>Nidaa</b> · {labels.pairTitle}</div>

        {phase.kind === "waiting" && (
          <>
            <div className="code" aria-label={phase.session.code}>{phase.session.code.split("").map((c, i) => <span key={i}>{c}</span>)}</div>
            <p className="hint">{labels.pairHint} <b>{labels.pairHintPath}</b> {labels.pairHintEnd}</p>
            <div className="status"><i />{labels.waiting}</div>
            <div className="expires">{labels.expiresIn} {mm}:{ss}</div>
          </>
        )}
        {phase.kind === "requesting" && <div className="status"><i />{labels.requesting}</div>}
        {phase.kind === "paired" && <div className="status"><i />{labels.pairedLoading}</div>}
        {phase.kind === "error" && (
          <>
            <div className="status"><i className="err" />{labels.offline}</div>
            <p className="error">{phase.message}</p>
            <button className="btn primary" onClick={() => void requestCode()}>{labels.retry}</button>
          </>
        )}
        <div className="url">{API_URL}</div>
      </div>
    </div>
  );
}
