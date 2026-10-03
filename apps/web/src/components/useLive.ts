"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toIsoDate } from "@nidaa/prayer-engine";

/** Horloge à la seconde. L'état initial vient du serveur pour une hydratation déterministe. */
export function useNow(initialNow: number): Date {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** URL de l'API vue par le navigateur (figée à la compilation). */
const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/**
 * Garde la page à jour : le navigateur se connecte directement au flux SSE public de l'API (CORS ouvert à toute origine,
 * voir CONTRACT.md) → à chaque nouvelle version, purge le cache serveur puis `router.refresh()`.
 * Rafraîchit aussi au changement de jour dans le fuseau de la mosquée.
 */
export function useLiveRefresh(slug: string, version: number, today: string, timezone: string, now: Date) {
  const router = useRouter();
  const known = useRef(version);
  useEffect(() => { known.current = Math.max(known.current, version); }, [version]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`${PUBLIC_API_URL}/v1/mosques/${encodeURIComponent(slug)}/events`);
    const onVersion = async (e: MessageEvent) => {
      try {
        const v = Number(JSON.parse(e.data).version);
        if (!Number.isFinite(v) || v === known.current) return;
        known.current = v;
        await fetch(`/m/${slug}/revalidate?v=${v}`, { method: "POST" }).catch(() => undefined);
        router.refresh();
      } catch { /* message illisible : ignoré */ }
    };
    es.addEventListener("version", onVersion);
    return () => es.close();
  }, [slug, router]);

  const lastRollover = useRef(0);
  const current = toIsoDate(now, timezone);
  useEffect(() => {
    if (current === today || Date.now() - lastRollover.current < 60_000) return;
    lastRollover.current = Date.now();
    router.refresh();
  }, [current, today, router]);
}
