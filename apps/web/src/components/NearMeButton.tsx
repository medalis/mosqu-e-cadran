"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function NearMeButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");

  function locate() {
    if (!("geolocation" in navigator)) { setState("error"); setMsg("La géolocalisation n'est pas disponible sur cet appareil."); return; }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setState("idle"); router.push(`/?lat=${pos.coords.latitude.toFixed(5)}&lng=${pos.coords.longitude.toFixed(5)}`); },
      (err) => { setState("error"); setMsg(err.code === err.PERMISSION_DENIED ? "Autorisez la localisation pour voir les mosquées proches." : "Position introuvable. Réessayez ou cherchez par ville."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={locate} disabled={state === "loading"} className="btn disabled:opacity-60">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>
        {state === "loading" ? "Localisation…" : "Autour de moi"}
      </button>
      <p role="status" className="min-h-5 text-sm text-muted">{state === "error" ? msg : ""}</p>
    </div>
  );
}
