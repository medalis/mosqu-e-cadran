/** Scène principale : en-tête · horloge et pastille · arc + cartes · tuiles · bandeau, plus les écrans d'état et la barre de commandes. */
import { useEffect, useMemo, useRef, useState } from "react";
import { PRAYERS, PRAYER_NAMES, TIMES, type Prayer, type ScreenBundle, type TimeKey } from "@nidaa/shared";
import { useNow } from "../hooks/useNow";
import { buildDayModel, durationsOf, ensureDays, fmtDur, fmtDurShort, stateAt, toIsoDate } from "../model";
import { labelsFor, uiLangOf } from "../labels";
import { isAudioUnlocked, playAdhanTone, unlockAudio } from "../audio";
import type { SyncStatus } from "../sync";
import { Header } from "./Header";
import { Hero, type PillInfo } from "./Hero";
import { DayArc } from "./DayArc";
import { PrayerCards } from "./PrayerCards";
import { Tiles } from "./Tiles";
import { Footer } from "./Footer";
import { Overlays, type OverlayState } from "./Overlays";
import { ControlBar } from "./ControlBar";

interface Props { bundle: ScreenBundle; status: SyncStatus; onUnpair?: () => void; preview?: boolean }

const FORCE_MS = 12_000;

export function Display({ bundle, status, onUnpair, preview }: Props) {
  const now = useNow();
  const tz = bundle.mosque.timezone;
  const lang = uiLangOf(bundle.settings);
  const labels = labelsFor(lang);
  const todayIso = toIsoDate(now, tz);

  const days = useMemo(() => ensureDays(bundle, todayIso), [bundle, todayIso]);
  const model = useMemo(() => buildDayModel(days, todayIso, tz), [days, todayIso, tz]);
  const durations = useMemo(() => durationsOf(bundle), [bundle]);
  const order = useMemo<TimeKey[]>(() => (bundle.settings.showShuruq ? [...TIMES] : TIMES.filter((k) => k !== "shuruq")), [bundle.settings.showShuruq]);

  // ----- thème : celui du bundle, ou aperçu local via la barre -----
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const theme = previewTheme ?? bundle.settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (theme && theme !== "nuit") root.setAttribute("data-mosque-theme", theme); else root.removeAttribute("data-mosque-theme");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || "#070b16";
  }, [theme]);

  // ----- état machine (moteur partagé) + simulation forcée -----
  const [forced, setForced] = useState<{ s: OverlayState; until: number } | null>(null);
  const real = model ? stateAt(now, bundle, days) : null;
  const forcedActive = forced && now.getTime() < forced.until ? forced : null;
  useEffect(() => { if (forced && now.getTime() >= forced.until) setForced(null); }, [forced, now]);
  const state: OverlayState = forcedActive ? forcedActive.s : real && real.state !== "idle" ? real.state : "";
  const statePrayer: Prayer | null = forcedActive ? "dhuhr" : real && real.state !== "idle" ? real.current : null;

  // ----- son à l'adhan -----
  const prevState = useRef<OverlayState>("");
  const [audioHint, setAudioHint] = useState(false);
  useEffect(() => {
    if (state === "adhan" && prevState.current !== "adhan" && bundle.settings.adhanAudio !== "none") {
      if (isAudioUnlocked()) playAdhanTone(bundle.settings.adhanAudio); else setAudioHint(true);
    }
    prevState.current = state;
  }, [state, bundle.settings.adhanAudio]);
  useEffect(() => {
    if (bundle.settings.adhanAudio === "none") return;
    // Dans l'application Android TV, la WebView autorise le son sans geste : on débloque tout de suite.
    if ((window as unknown as { NidaaTV?: unknown }).NidaaTV && unlockAudio()) { setAudioHint(false); return; }
    const unlock = () => { if (unlockAudio()) { setAudioHint(false); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); } };
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
    if (!isAudioUnlocked()) setAudioHint(true);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [bundle.settings.adhanAudio]);

  // ----- barre de commandes visible 3,5 s après un mouvement -----
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const show = () => { document.body.classList.add("show-ui"); clearTimeout(t); t = setTimeout(() => document.body.classList.remove("show-ui"), 3500); };
    window.addEventListener("mousemove", show); window.addEventListener("touchstart", show, { passive: true }); window.addEventListener("keydown", show);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", show); window.removeEventListener("touchstart", show); window.removeEventListener("keydown", show); document.body.classList.remove("show-ui"); };
  }, []);

  // ----- verrou d'éveil -----
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => { try { lock = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* non supporté */ } };
    void req();
    const onVis = () => { if (document.visibilityState === "visible") void req(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); void lock?.release().catch(() => undefined); };
  }, []);

  if (!model) {
    return <div className="boot">{labels.loading}</div>;
  }

  // ----- pastille « prochaine prière » / « en cours » (adhan → iqama) -----
  const n = now.getTime();
  let cur: Prayer | null = null;
  for (const p of PRAYERS) if (n >= model.at[p].getTime() && n < model.iqamaAt[p].getTime()) cur = p;
  let pill: PillInfo;
  if (cur) {
    const a = model.at[cur].getTime(), i = model.iqamaAt[cur].getTime();
    pill = { label: labels.inProgress, name: PRAYER_NAMES[cur][lang], nameAr: PRAYER_NAMES[cur].ar, toLabel: labels.iqamaIn, countdown: fmtDur(i - n), frac: i > a ? (n - a) / (i - a) : 1 };
  } else {
    const next = real?.next ?? "fajr", nextAt = real?.nextAt ?? model.fajrTomorrow, prevAt = real?.prevAt ?? model.prevIsha;
    pill = { label: labels.nextPrayer, name: PRAYER_NAMES[next][lang], nameAr: PRAYER_NAMES[next].ar, toLabel: labels.adhanIn, countdown: fmtDur(nextAt.getTime() - n), frac: (n - prevAt.getTime()) / (nextAt.getTime() - prevAt.getTime()) };
  }
  const hi: TimeKey = cur ?? real?.next ?? "fajr";
  const isPast = (k: TimeKey) => model.at[k].getTime() < n && k !== cur;

  // Compte à rebours / anneau des écrans d'état (en simulation, cycle factice comme dans le prototype).
  let duaCountdown = "--:--", iqamaFrac = 0;
  if (forcedActive) {
    duaCountdown = fmtDurShort((FORCE_MS - (forcedActive.until - n)) % 60_000);
    iqamaFrac = (now.getSeconds() % 12) / 12;
  } else if (real && real.state !== "idle") {
    duaCountdown = fmtDurShort(real.iqamaAt.getTime() - n);
    iqamaFrac = Math.max(0, Math.min(1, (n - real.iqamaAt.getTime()) / (durations.iqama * 60_000)));
  }

  return (
    <>
      <div className="sky" /><div className="pattern" /><div className="glow a" /><div className="glow b" />
      <div className="scene">
        <Header mosque={bundle.mosque} now={now} day={model.today} lang={lang} subtitle={preview ? (status.source === "demo" ? labels.demoCity : labels.preview) : undefined} />
        <Hero now={now} timezone={tz} pill={pill} labels={labels} />
        <section className="day">
          <DayArc model={model} now={now} order={order} highlight={hi} isPast={isPast} />
          <PrayerCards model={model} order={order} highlight={hi} isPast={isPast} labels={labels} lang={lang} />
        </section>
        <Tiles bundle={bundle} now={now} labels={labels} lang={lang} />
        <Footer flash={bundle.flashMessage} online={status.online} labels={labels} />
      </div>

      <Overlays state={state} prayer={statePrayer} bundle={bundle} duaCountdown={duaCountdown} iqamaFrac={iqamaFrac} labels={labels} lang={lang} />

      {audioHint && <div className="toast" role="status"><i />{labels.audioHint}</div>}

      <ControlBar
        forced={forcedActive ? forcedActive.s : null}
        onForce={(s) => setForced(s ? { s, until: Date.now() + FORCE_MS } : null)}
        theme={theme} bundleTheme={bundle.settings.theme} onPreviewTheme={setPreviewTheme}
        onUnpair={onUnpair} labels={labels}
      />
    </>
  );
}
