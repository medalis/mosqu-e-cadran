"use client";
import { useState } from "react";

export function CopySnippet({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "ok" | "ko">("idle");
  async function copy() {
    try { await navigator.clipboard.writeText(code); setState("ok"); } catch { setState("ko"); }
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <div className="min-w-0">
      <pre tabIndex={0} aria-label="Code d'intégration" className="overflow-x-auto rounded-xl border border-line bg-bg px-4 py-3 text-[13px] leading-relaxed text-fg"><code>{code}</code></pre>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={copy} className="btn text-sm">Copier le code</button>
        <span role="status" className="text-sm text-teal">{state === "ok" ? "Copié" : state === "ko" ? "Copie impossible — sélectionnez le code." : ""}</span>
      </div>
    </div>
  );
}
