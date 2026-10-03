import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PrayerDay } from "@nidaa/shared";
import { TIMES, PRAYER_NAMES } from "@nidaa/shared";
import { toIsoDate } from "@nidaa/prayer-engine";
import { ApiError, getAnnouncements, getCalendar, getDay, getMosque, SITE_URL, SLUG_RE, type Announcement } from "@/lib/api";
import { hijriAr, hijriFr, isFriday, LANG_LABELS, longDate, monthLabel, safeUrl, SERVICE_LABELS, shiftIso, shiftMonth, SPECIAL_LABELS, weekdayShort } from "@/lib/format";
import { PrayerHero } from "@/components/PrayerHero";
import { CopySnippet } from "@/components/CopySnippet";
import { Unavailable } from "@/components/Unavailable";

// Données mises en cache 60 s (et purgées à chaque événement « version » de la mosquée).
export const revalidate = 60;

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ month?: string | string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    const m = SLUG_RE.test(slug) ? await getMosque(slug) : null;
    if (!m) return { title: "Mosquée introuvable", robots: { index: false } };
    const title = `${m.name} — horaires de prière à ${m.city}`;
    const description = (m.description ?? `Horaires de prière réels (adhan et iqama), Jumu'a, annonces et informations pratiques de ${m.name}, ${m.city}.`).slice(0, 200);
    // Première photo de la fiche = image de partage (OpenGraph, Twitter).
    const first = m.photos[0];
    const cover = first && safeUrl(first.url) ? first : null;
    return {
      title, description,
      alternates: { canonical: `/m/${m.slug}` },
      openGraph: { title, description, url: `/m/${m.slug}`, type: "website", siteName: "Nidaa", locale: "fr_FR", ...(cover ? { images: [{ url: cover.url, ...(cover.width && cover.height ? { width: cover.width, height: cover.height } : {}), alt: m.name }] } : {}) },
      twitter: { card: cover ? "summary_large_image" : "summary", title, description, ...(cover ? { images: [cover.url] } : {}) },
    };
  } catch {
    return { title: "Horaires de prière" };
  }
}

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="mb-4 text-xl font-medium">{children}</h2>;

export default async function MosquePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!SLUG_RE.test(slug)) notFound();

  let mosque;
  try { mosque = await getMosque(slug); }
  catch (e) { if (e instanceof ApiError) return <Unavailable retryHref={`/m/${slug}`} />; throw e; }
  if (!mosque) notFound();

  const tz = mosque.timezone;
  const todayIso = toIsoDate(new Date(), tz);
  const rawMonth = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : todayIso.slice(0, 7);

  const [today, tomorrow, calendar, announcements] = await Promise.all([
    getDay(slug, todayIso).catch(() => null),
    getDay(slug, shiftIso(todayIso, 1)).catch(() => null),
    getCalendar(slug, month).catch((): PrayerDay[] | null => null),
    getAnnouncements(slug).catch((): Announcement[] => []),
  ]);

  const website = safeUrl(mosque.website), donation = safeUrl(mosque.donationUrl);
  const coords = `${mosque.latitude},${mosque.longitude}`;
  const osm = `https://www.openstreetmap.org/?mlat=${mosque.latitude}&mlon=${mosque.longitude}#map=17/${mosque.latitude}/${mosque.longitude}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords)}`;
  const photos = mosque.photos.filter((p) => safeUrl(p.url));
  const specials = mosque.specialPrayers.filter((s) => s.date >= todayIso);
  const pageUrl = `${SITE_URL}/m/${mosque.slug}`;
  const snippet = `<iframe src="${pageUrl}/embed?theme=dark&lang=fr" title="Horaires de prière — ${mosque.name.replace(/"/g, "&quot;")}" width="100%" height="300" style="border:0;max-width:480px" loading="lazy"></iframe>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["PlaceOfWorship", "Mosque"],
    name: mosque.name,
    ...(mosque.nameAr ? { alternateName: mosque.nameAr } : {}),
    ...(mosque.description ? { description: mosque.description } : {}),
    url: pageUrl,
    address: { "@type": "PostalAddress", ...(mosque.address ? { streetAddress: mosque.address } : {}), addressLocality: mosque.city, addressCountry: mosque.countryCode },
    geo: { "@type": "GeoCoordinates", latitude: mosque.latitude, longitude: mosque.longitude },
    hasMap: osm,
    ...(mosque.phone ? { telephone: mosque.phone } : {}),
    ...(mosque.email ? { email: mosque.email } : {}),
    ...(website ? { sameAs: [website] } : {}),
    ...(photos.length ? { image: photos.map((p) => p.url) } : {}),
    ...(mosque.services.length ? { amenityFeature: mosque.services.map((s) => ({ "@type": "LocationFeatureSpecification", name: SERVICE_LABELS[s] ?? s, value: true })) } : {}),
  };

  return (
    <article className="min-w-0 space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="flex flex-col gap-5 pt-4 sm:pt-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{mosque.city}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 px-2.5 py-0.5 normal-case tracking-normal text-teal">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              Mosquée vérifiée
            </span>
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-balance sm:text-5xl">{mosque.name}</h1>
          {mosque.nameAr && <p lang="ar" dir="rtl" className="mt-2 text-left font-ar text-3xl text-gold2 sm:text-4xl">{mosque.nameAr}</p>}
          {mosque.address && <p className="mt-3 text-muted">{mosque.address}, {mosque.city}</p>}
        </div>
        {today && (
          <div className="shrink-0 md:text-right">
            <p className="text-lg">{longDate(today.date)}</p>
            <p className="text-muted">{hijriFr(today.hijri)}</p>
            <p lang="ar" dir="rtl" className="font-ar text-xl text-left text-gold2 md:text-right">{hijriAr(today.hijri)}</p>
          </div>
        )}
      </header>

      <section aria-labelledby="horaires">
        <h2 id="horaires" className="sr-only">Horaires de prière du jour</h2>
        {today ? (
          <>
            <PrayerHero slug={mosque.slug} version={mosque.version} timezone={tz} today={today} tomorrow={tomorrow} initialNow={Date.now()} />
            <p className="mt-3 text-sm text-muted">
              {today.source === "calculated" ? "Horaires calculés selon les réglages de la mosquée." : "Horaires communiqués par la mosquée."} Heure locale ({tz}).
            </p>
          </>
        ) : (
          <p className="card p-6 text-muted">Les horaires du jour ne sont pas disponibles pour le moment.</p>
        )}
      </section>

      {photos.length > 0 && (
        <section aria-labelledby="photos" data-testid="gallery">
          <h2 id="photos" className="sr-only">Photos de la mosquée</h2>
          {/* Placée après les horaires, qui restent le premier contenu de la page. <img> simple plutôt que next/image : les photos viennent d'un stockage externe (Supabase Storage ou l'API),
              sans optimiseur ni liste d'hôtes à tenir à jour ; les cadres à proportions fixes évitent tout saut de mise en page. */}
          <a href={photos[0]!.url} target="_blank" rel="noopener" className="card block overflow-hidden">
            <div className="relative aspect-[16/10] bg-bg2 sm:aspect-[21/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[0]!.url} alt={`${mosque.name} — photo principale`} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          </a>
          {photos.length > 1 && (
            <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {photos.slice(1).map((p, i) => (
                <li key={p.id}>
                  <a href={p.url} target="_blank" rel="noopener" className="card block overflow-hidden">
                    <div className="relative aspect-[4/3] bg-bg2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`${mosque.name} — photo ${i + 2}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="jumua" className="card min-w-0 p-6">
          <H2 id="jumua">Jumu'a <span lang="ar" dir="rtl" className="ml-1 font-ar text-gold2">الجمعة</span></H2>
          {mosque.jumua.length === 0 ? <p className="text-muted">Horaire non communiqué.</p> : (
            <ul className="space-y-3">
              {mosque.jumua.map((j, i) => (
                <li key={i} className="flex items-center justify-between gap-4 border-t border-line pt-3 first:border-0 first:pt-0">
                  <div>
                    <p className="text-sm text-muted">{mosque.jumua.length > 1 ? `Office ${i + 1} · ` : ""}Prêche à <span className="tabular-nums text-fg">{j.khutbaTime}</span></p>
                    {j.language && <p className="text-sm text-muted">Prêche en {LANG_LABELS[j.language] ?? j.language}</p>}
                  </div>
                  <p className="text-3xl font-light text-gold2 tabular-nums">{j.prayerTime}</p>
                </li>
              ))}
            </ul>
          )}
          {specials.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="eyebrow mb-3">Prières particulières</h3>
              <ul className="space-y-3">
                {specials.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">{s.label || SPECIAL_LABELS[s.kind]}</p>
                      <p className="text-sm text-muted">{longDate(s.date)}{s.locationNote ? ` · ${s.locationNote}` : ""}</p>
                    </div>
                    <p className="text-2xl font-light text-gold2 tabular-nums">{s.time}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="annonces" className="card min-w-0 p-6 lg:col-span-2">
          <H2 id="annonces">Annonces</H2>
          {announcements.length === 0 ? <p className="text-muted">Aucune annonce en cours.</p> : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {announcements.map((a) => {
                const media = a.type === "image" ? safeUrl(a.mediaUrl) : null;
                return (
                  <li key={a.id} className="rounded-xl border border-line bg-panel p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {media && <img src={media} alt="" loading="lazy" className="mb-3 max-h-56 w-full rounded-lg object-cover" />}
                    <h3 className="font-medium text-gold2">{a.title}</h3>
                    {a.body && <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-fg/85">{a.body}</p>}
                    {a.endsAt && <p className="mt-2 text-xs text-muted">Jusqu'au {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: tz }).format(new Date(a.endsAt))}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="calendrier" className="scroll-mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="calendrier" className="text-xl font-medium">Calendrier · {monthLabel(month)}</h2>
          <nav aria-label="Navigation par mois" className="flex items-center gap-2 text-sm">
            <Link href={`/m/${slug}?month=${shiftMonth(month, -1)}#calendrier`} className="btn px-3.5 py-1.5" scroll={false} rel="nofollow"><span aria-hidden="true">←</span> {monthLabel(shiftMonth(month, -1)).split(" ")[0]}</Link>
            {month !== todayIso.slice(0, 7) && <Link href={`/m/${slug}#calendrier`} className="btn px-3.5 py-1.5" scroll={false}>Ce mois-ci</Link>}
            <Link href={`/m/${slug}?month=${shiftMonth(month, 1)}#calendrier`} className="btn px-3.5 py-1.5" scroll={false} rel="nofollow">{monthLabel(shiftMonth(month, 1)).split(" ")[0]} <span aria-hidden="true">→</span></Link>
          </nav>
        </div>
        {calendar === null ? <p className="card p-6 text-muted">Le calendrier n'a pas pu être chargé. Réessayez dans un instant.</p>
          : calendar.length === 0 ? <p className="card p-6 text-muted">Aucun horaire publié pour ce mois.</p> : (
          <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label={`Horaires de ${monthLabel(month)}`}>
            <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[.1em] text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Jour</th>
                  <th scope="col" className="px-3 py-3 font-medium">Hégire</th>
                  {TIMES.map((k) => <th key={k} scope="col" className="px-3 py-3 text-right font-medium">{PRAYER_NAMES[k].fr}</th>)}
                </tr>
              </thead>
              <tbody>
                {calendar.map((d) => {
                  const isToday = d.date === todayIso;
                  return (
                    <tr key={d.date} aria-current={isToday ? "date" : undefined} className={`border-t border-line ${isToday ? "bg-gold/15 text-fg" : isFriday(d.date) ? "bg-panel" : ""}`}>
                      <th scope="row" className={`whitespace-nowrap px-4 py-2.5 text-left font-normal ${isToday ? "border-l-2 border-gold font-medium text-gold2" : "border-l-2 border-transparent"}`}>
                        <span className="inline-block w-10 capitalize text-muted">{weekdayShort(d.date)}</span>{Number(d.date.slice(8))}
                        {isToday && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-on-gold">Aujourd'hui</span>}
                      </th>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted">{d.hijri.day} {d.hijri.monthNameFr}</td>
                      {TIMES.map((k) => <td key={k} className={`px-3 py-2.5 text-right ${k === "shuruq" ? "text-muted" : ""}`}>{d.times[k]}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="infos" className="card min-w-0 p-6">
          <H2 id="infos">Informations pratiques</H2>
          {mosque.description && <p className="mb-5 leading-relaxed text-fg/85">{mosque.description}</p>}
          {mosque.services.length > 0 && (
            <>
              <h3 className="eyebrow mb-2">Services</h3>
              <ul className="mb-5 flex flex-wrap gap-2">
                {mosque.services.map((s) => <li key={s} className="rounded-full border border-line bg-panel px-3 py-1 text-sm">{SERVICE_LABELS[s] ?? s}</li>)}
              </ul>
            </>
          )}
          <h3 className="eyebrow mb-2">Contact</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
            {mosque.phone && <><dt className="text-muted">Téléphone</dt><dd><a className="link tabular-nums" href={`tel:${mosque.phone.replace(/[^\d+]/g, "")}`}>{mosque.phone}</a></dd></>}
            {mosque.email && <><dt className="text-muted">E-mail</dt><dd className="break-all"><a className="link" href={`mailto:${mosque.email}`}>{mosque.email}</a></dd></>}
            {website && <><dt className="text-muted">Site web</dt><dd className="break-all"><a className="link" href={website} rel="noopener nofollow" target="_blank">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></dd></>}
            {!mosque.phone && !mosque.email && !website && <dd className="col-span-2 text-muted">Aucun contact communiqué.</dd>}
          </dl>
          {donation && (
            <a href={donation} target="_blank" rel="noopener nofollow" className="btn btn-gold mt-6">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.300 2.900 4.500 6.600 4.500c2 0 3.400 1 4.400 2.400 1-1.400 2.400-2.400 4.400-2.400 3.700 0 5.700 3.800 4.200 7.200C19.500 16.400 12 21 12 21z" /></svg>
              Faire un don à la mosquée
            </a>
          )}
        </section>

        <section aria-labelledby="acces" className="card flex min-w-0 flex-col p-6">
          <H2 id="acces">Accès</H2>
          <address className="not-italic leading-relaxed">
            {mosque.address && <>{mosque.address}<br /></>}
            {mosque.city} ({mosque.countryCode})
          </address>
          <p className="mt-2 text-sm text-muted tabular-nums">GPS : {mosque.latitude.toFixed(5)}, {mosque.longitude.toFixed(5)}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={directions} target="_blank" rel="noopener" className="btn btn-gold">Itinéraire</a>
            <a href={osm} target="_blank" rel="noopener" className="btn">Voir sur la carte</a>
          </div>

          <div className="mt-8 border-t border-line pt-5">
            <h3 className="mb-1 font-medium">Intégrer sur votre site</h3>
            <p className="mb-3 text-sm text-muted">Collez ce code pour afficher les horaires du jour. Options : <code>theme=light|dark</code>, <code>lang=fr|ar|en</code>.</p>
            <CopySnippet code={snippet} />
          </div>
        </section>
      </div>
    </article>
  );
}
