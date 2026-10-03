/** Routeur par état : démarrage → appairage | affichage. `?preview=<slug>` court-circuite l'appairage. */
import { useCallback, useEffect, useState } from "react";
import type { ScreenBundle } from "@nidaa/shared";
import { clearAll, loadBundle, loadDeviceToken, saveDeviceToken } from "./store";
import { useDeviceSync, usePreviewBundle } from "./sync";
import { labelsFor } from "./labels";
import { LogoDefs, Logo } from "./components/Logo";
import { Pairing } from "./components/Pairing";
import { Display } from "./components/Display";

type Boot = { phase: "loading" } | { phase: "ready"; deviceToken: string | null; bundle: ScreenBundle | undefined };

const previewSlug = new URLSearchParams(window.location.search).get("preview");

export default function App() {
  const [boot, setBoot] = useState<Boot>({ phase: "loading" });

  useEffect(() => {
    if (previewSlug) { setBoot({ phase: "ready", deviceToken: null, bundle: undefined }); return; }
    (async () => {
      const [deviceToken, bundle] = await Promise.all([loadDeviceToken(), loadBundle()]);
      setBoot({ phase: "ready", deviceToken: deviceToken ?? null, bundle });
    })();
  }, []);

  const onPaired = useCallback(async (deviceToken: string) => {
    await saveDeviceToken(deviceToken);
    setBoot({ phase: "ready", deviceToken, bundle: undefined });
  }, []);

  const onUnpair = useCallback(async () => {
    await clearAll();
    document.documentElement.removeAttribute("data-mosque-theme");
    setBoot({ phase: "ready", deviceToken: null, bundle: undefined });
  }, []);

  return (
    <>
      <LogoDefs />
      {boot.phase === "loading" ? (
        <div className="boot"><div><Logo />{labelsFor("fr").loading}</div></div>
      ) : previewSlug ? (
        <PreviewRoute slug={previewSlug} />
      ) : boot.deviceToken ? (
        <DeviceRoute key={boot.deviceToken} deviceToken={boot.deviceToken} initial={boot.bundle} onUnpair={onUnpair} />
      ) : (
        <>
          <div className="sky" /><div className="pattern" /><div className="glow a" /><div className="glow b" />
          <Pairing onPaired={onPaired} labels={labelsFor("fr")} />
        </>
      )}
    </>
  );
}

function DeviceRoute({ deviceToken, initial, onUnpair }: { deviceToken: string; initial: ScreenBundle | undefined; onUnpair: () => void }) {
  const { bundle, status } = useDeviceSync(deviceToken, initial);
  if (!bundle) {
    return (
      <>
        <div className="sky" /><div className="pattern" /><div className="glow a" /><div className="glow b" />
        <div className="boot"><div><Logo />{status.lastError ? `${labelsFor("fr").offline} · ${status.lastError}` : labelsFor("fr").pairedLoading}</div></div>
        <div className="demo" style={{ opacity: 1, transform: "translate(-50%,0)", pointerEvents: "auto" }}>
          <button className="danger" onClick={() => { if (window.confirm(labelsFor("fr").confirmUnpair)) onUnpair(); }}>{labelsFor("fr").unpair}</button>
        </div>
      </>
    );
  }
  return <Display bundle={bundle} status={status} onUnpair={onUnpair} />;
}

function PreviewRoute({ slug }: { slug: string }) {
  const { bundle, status } = usePreviewBundle(slug);
  if (!bundle) return <div className="boot"><div><Logo />{labelsFor("fr").loading}</div></div>;
  return <Display bundle={bundle} status={status} preview />;
}
