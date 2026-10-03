/** Synchronisation du bundle : GET conditionnel (ETag), SSE `version`, repli en sondage 60 s, battement de cœur 5 min. */
import { useEffect, useRef, useState } from "react";
import { toIsoDate } from "@nidaa/prayer-engine";
import type { ScreenBundle } from "@nidaa/shared";
import { eventsUrl, fetchBundle, fetchPublicAnnouncements, fetchPublicCalendar, fetchPublicMosque, heartbeat } from "./api";
import { buildDemoBundle, computeDays, DEFAULT_SETTINGS, DEMO_IQAMA_RULES, DEMO_PRAYER_CONFIG } from "./demo";
import { saveBundle } from "./store";

const POLL_MS = 60_000;
const HEARTBEAT_MS = 5 * 60_000;

export interface SyncStatus { online: boolean; lastSyncAt: Date | null; lastError: string | null; source: "live" | "cache" | "demo" | "none" }

export function useDeviceSync(deviceToken: string | null, initial: ScreenBundle | undefined) {
  const [bundle, setBundle] = useState<ScreenBundle | undefined>(initial);
  const [status, setStatus] = useState<SyncStatus>({ online: false, lastSyncAt: null, lastError: null, source: initial ? "cache" : "none" });
  const bundleRef = useRef<ScreenBundle | undefined>(initial);
  const driftRef = useRef(0);

  useEffect(() => {
    if (!deviceToken) return;
    let alive = true;
    let inflight = false;

    const sync = async () => {
      if (inflight) return;
      inflight = true;
      try {
        const fresh = await fetchBundle(deviceToken, bundleRef.current?.version);
        if (!alive) return;
        if (fresh) {
          driftRef.current = new Date(fresh.serverTime).getTime() - Date.now();
          bundleRef.current = fresh;
          setBundle(fresh);
          void saveBundle(fresh);
        }
        setStatus({ online: true, lastSyncAt: new Date(), lastError: null, source: "live" });
      } catch (e) {
        if (!alive) return;
        setStatus((s) => ({ ...s, online: false, lastError: e instanceof Error ? e.message : String(e), source: bundleRef.current ? (s.source === "live" ? "live" : "cache") : "none" }));
      } finally { inflight = false; }
    };

    void sync();
    const poll = setInterval(sync, POLL_MS);

    // SSE : un événement `version` différent de la version en cache déclenche un refetch.
    let es: EventSource | null = null;
    let esRetry: ReturnType<typeof setTimeout> | null = null;
    const openEvents = () => {
      try {
        es = new EventSource(eventsUrl(deviceToken));
        const onVersion = (ev: MessageEvent) => {
          try {
            const data = JSON.parse(ev.data as string) as { version?: number };
            if (data.version != null && data.version !== bundleRef.current?.version) void sync();
          } catch { void sync(); }
        };
        es.addEventListener("version", onVersion as EventListener);
        es.onmessage = (ev) => onVersion(ev);
        es.onopen = () => { if (alive) setStatus((s) => ({ ...s, online: true })); };
        es.onerror = () => {
          es?.close(); es = null;
          if (alive && !esRetry) esRetry = setTimeout(() => { esRetry = null; openEvents(); }, 15_000);
        };
      } catch { /* EventSource indisponible : le sondage suffit */ }
    };
    openEvents();

    const beat = () => {
      const b = bundleRef.current;
      void heartbeat(deviceToken, { clockDriftMs: Math.round(driftRef.current), bundleVersion: b?.version ?? 0 }).catch(() => undefined);
    };
    const hb = setInterval(beat, HEARTBEAT_MS);
    const firstBeat = setTimeout(beat, 5_000);

    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);

    return () => {
      alive = false;
      clearInterval(poll); clearInterval(hb); clearTimeout(firstBeat);
      if (esRetry) clearTimeout(esRetry);
      es?.close();
      window.removeEventListener("online", onOnline);
    };
  }, [deviceToken]);

  return { bundle, status };
}

/** Mode aperçu `?preview=<slug>` : bundle construit depuis les endpoints publics, sinon démo locale. */
export function usePreviewBundle(slug: string | null) {
  const [bundle, setBundle] = useState<ScreenBundle | undefined>();
  const [status, setStatus] = useState<SyncStatus>({ online: false, lastSyncAt: null, lastError: null, source: "none" });

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      try {
        const mosque = await fetchPublicMosque(slug);
        const now = new Date();
        const ym = (d: Date) => toIsoDate(d, mosque.timezone).slice(0, 7);
        const next = new Date(now); next.setUTCMonth(next.getUTCMonth() + 1, 1);
        const [m1, m2, announcements] = await Promise.all([
          fetchPublicCalendar(slug, ym(now)),
          fetchPublicCalendar(slug, ym(next)).catch(() => []),
          fetchPublicAnnouncements(slug).catch(() => []),
        ]);
        const days = [...m1, ...m2].filter((d, i, arr) => arr.findIndex((x) => x.date === d.date) === i).sort((a, b) => a.date.localeCompare(b.date));
        const demo = buildDemoBundle(now);
        const b: ScreenBundle = {
          version: 0, generatedAt: now.toISOString(), serverTime: now.toISOString(),
          mosque: { id: mosque.id, slug: mosque.slug, name: mosque.name, nameAr: mosque.nameAr, city: mosque.city, timezone: mosque.timezone, latitude: mosque.latitude, longitude: mosque.longitude },
          settings: DEFAULT_SETTINGS, prayerConfig: DEMO_PRAYER_CONFIG, iqamaRules: DEMO_IQAMA_RULES,
          jumua: mosque.jumua ?? [], specialPrayers: [],
          days: days.length ? days : computeDays(mosque, DEMO_PRAYER_CONFIG, DEMO_IQAMA_RULES, toIsoDate(now, mosque.timezone), 60),
          announcements: announcements.map((a) => ({ ...a, targets: a.targets?.length ? [...a.targets, "screen" as const] : ["screen" as const] })),
          flashMessage: null, contentItems: demo.contentItems,
        };
        if (!alive) return;
        setBundle(b);
        setStatus({ online: true, lastSyncAt: now, lastError: null, source: "live" });
      } catch (e) {
        if (!alive) return;
        setBundle(buildDemoBundle());
        setStatus({ online: false, lastSyncAt: null, lastError: e instanceof Error ? e.message : String(e), source: "demo" });
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  return { bundle, status };
}
