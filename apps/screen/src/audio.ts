/** Son d'adhan minimal : trois notes WebAudio (aucun fichier). Ne joue qu'après un geste utilisateur ayant débloqué l'audio. */
let ctx: AudioContext | null = null;
let unlocked = false;

export function isAudioUnlocked() { return unlocked; }

export function unlockAudio(): boolean {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    unlocked = true;
    return true;
  } catch { return false; }
}

export function playAdhanTone(kind: "beep" | "full") {
  if (!unlocked || !ctx) return;
  const notes = kind === "full" ? [392, 523.25, 587.33, 523.25, 392] : [523.25, 659.25, 783.99];
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((f, i) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain();
    o.type = "sine"; o.frequency.value = f;
    const start = t0 + i * 0.55, dur = 0.5;
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(0.25, start + 0.05); g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g).connect(ctx!.destination);
    o.start(start); o.stop(start + dur + 0.05);
  });
}
