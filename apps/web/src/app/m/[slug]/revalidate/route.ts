import { revalidateTag } from "next/cache";
import { mosqueTag, SLUG_RE } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Au plus une purge par mosquée toutes les 5 s (mémoire du processus : suffisant pour un serveur unique). */
const WINDOW_MS = 5000;
const MAX_ENTRIES = 5000;
const state = new Map<string, { last: number; version: string | null }>();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Vrai si la requête vient d'une page de ce site (en-têtes posés par le navigateur, non modifiables par un script tiers). */
function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}

/**
 * Purge le cache de données d'une mosquée (appelé par le client à la réception d'un événement « version »).
 * Protections : POST uniquement (seule méthode exportée), même origine, et limitation par slug —
 * un appel pour une version déjà purgée est ignoré ; un appel trop rapproché attend la fin de la fenêtre de 5 s
 * et les appels simultanés sont regroupés en une seule purge (aucune modification n'est perdue).
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return new Response(null, { status: 404 });
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const v = new URL(req.url).searchParams.get("v");
  const version = v && /^\d{1,12}$/.test(v) ? v : null;

  const seen = state.get(slug);
  if (seen) {
    if (version && seen.version === version) return new Response(null, { status: 204 }); // déjà purgé pour cette version
    const wait = seen.last + WINDOW_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
      // Une autre requête en attente a purgé entre-temps : sa purge couvre aussi cette modification.
      if (state.get(slug)?.last !== seen.last) return new Response(null, { status: 204 });
    }
  }
  if (state.size >= MAX_ENTRIES) {
    const limit = Date.now() - WINDOW_MS;
    for (const [k, e] of state) if (e.last < limit) state.delete(k);
    if (state.size >= MAX_ENTRIES) return new Response(null, { status: 429 });
  }
  state.set(slug, { last: Date.now(), version });
  revalidateTag(mosqueTag(slug));
  return new Response(null, { status: 204 });
}
