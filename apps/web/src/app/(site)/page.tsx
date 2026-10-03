import Link from "next/link";
import { PRAYER_NAMES } from "@nidaa/shared";
import { ApiError, getDay, searchMosques, type MosqueSummary, type TimesResponse } from "@/lib/api";
import { formatKm } from "@/lib/format";
import { toIsoDate } from "@nidaa/prayer-engine";
import { nextPrayer } from "@/lib/next-prayer";
import { formatHM } from "@nidaa/prayer-engine";
import { NearMeButton } from "@/components/NearMeButton";
import { Unavailable } from "@/components/Unavailable";

type Search = { q?: string | string[]; lat?: string | string[]; lng?: string | string[] };
const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const coord = (v: string | undefined, max: number) => { const n = v == null ? NaN : Number(v); return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined; };

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const lat = coord(one(sp.lat), 90), lng = coord(one(sp.lng), 180);
  const geo = lat != null && lng != null;

  let mosques: MosqueSummary[] | null = null;
  try { mosques = await searchMosques({ q, ...(geo ? { lat, lng, radiusKm: 10 } : {}) }); }
  catch (e) { if (!(e instanceof ApiError)) throw e; }

  // Prochaine prière par carte : seulement pour les premiers résultats (réponses mises en cache 60 s).
  const now = new Date();
  const nexts = new Map<string, string>();
  if (mosques) {
    await Promise.all(mosques.slice(0, 12).map(async (m) => {
      try {
        const day: TimesResponse | null = await getDay(m.slug, toIsoDate(now, m.timezone));
        if (!day) return;
        const n = nextPrayer(now, m.timezone, day, null);
        nexts.set(m.slug, `${n.phase === "iqama" ? "Iqama " : ""}${PRAYER_NAMES[n.prayer].fr} à ${formatHM(n.at, m.timezone)}`);
      } catch { /* la carte s'affiche sans la prochaine prière */ }
    }));
  }

  const heading = geo ? "Mosquées à moins de 10 km" : q ? `Résultats pour « ${q} »` : "Mosquées sur Nidaa";

  return (
    <>
      <section className="mx-auto max-w-3xl pt-10 pb-10 text-center sm:pt-16">
        <p lang="ar" dir="rtl" className="font-ar text-3xl text-gold2 sm:text-4xl">حيّ على الصلاة</p>
        <h1 className="mt-4 text-4xl font-light tracking-tight text-balance sm:text-5xl">Les horaires réels de <span className="font-medium text-gold2">votre</span> mosquée</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted text-balance">Adhan et iqama tels que votre mosquée les annonce — pas des horaires calculés génériques.</p>

        <form action="/" method="get" role="search" className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
          <label htmlFor="q" className="sr-only">Nom de la mosquée ou ville</label>
          <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Nom de la mosquée ou ville" autoComplete="off" maxLength={80}
            className="min-w-0 flex-1 rounded-full border border-line bg-panel px-5 py-3 text-base text-fg placeholder:text-muted focus-visible:border-gold" />
          <button type="submit" className="btn btn-gold px-6">Rechercher</button>
        </form>
        <div className="mt-4"><NearMeButton /></div>
      </section>

      {mosques === null ? <Unavailable retryHref="/" /> : (
        <section aria-labelledby="resultats">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="resultats" className="text-xl font-medium">{heading}</h2>
            <p className="text-sm text-muted">
              {mosques.length} mosquée{mosques.length > 1 ? "s" : ""}
              {(q || geo) && <> · <Link href="/" className="link">Tout afficher</Link></>}
            </p>
          </div>
          {mosques.length === 0 ? (
            <p className="card p-8 text-center text-muted">Aucune mosquée ne correspond à votre recherche. Essayez un autre nom ou une autre ville.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mosques.map((m) => (
                <li key={m.id}>
                  <Link href={`/m/${m.slug}`} className="card group flex h-full flex-col gap-3 p-5 transition-colors hover:border-gold/60 hover:bg-panel2">
                    <div>
                      <h3 className="text-lg font-medium leading-snug group-hover:text-gold2">{m.name}</h3>
                      {m.nameAr && <p lang="ar" dir="rtl" className="mt-1 text-left font-ar text-xl text-gold2">{m.nameAr}</p>}
                    </div>
                    <p className="text-sm text-muted">
                      {m.city}{m.address ? ` · ${m.address}` : ""}
                      {m.distanceKm != null && <span className="ml-2 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs text-teal tabular-nums">à {formatKm(m.distanceKm)}</span>}
                    </p>
                    <p className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                      <span className="tabular-nums text-fg">{nexts.has(m.slug) ? <><span className="text-muted">Prochaine : </span>{nexts.get(m.slug)}</> : <span className="text-muted">Voir les horaires</span>}</span>
                      <span aria-hidden="true" className="text-gold transition-transform group-hover:translate-x-0.5">→</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
