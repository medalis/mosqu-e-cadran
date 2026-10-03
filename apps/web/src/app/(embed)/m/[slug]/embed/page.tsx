import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toIsoDate } from "@nidaa/prayer-engine";
import { ApiError, getDay, getMosque, SITE_URL, SLUG_RE } from "@/lib/api";
import { hijriAr, hijriFr, longDate, shiftIso } from "@/lib/format";
import { EmbedWidget, type EmbedLang } from "@/components/EmbedWidget";
import { Logo } from "@/components/Logo";

export const revalidate = 60;
export const metadata: Metadata = { title: "Horaires de prière", robots: { index: false, follow: false } };

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
const LOCALES: Record<EmbedLang, string> = { fr: "fr-FR", en: "en-GB", ar: "ar" };
const MSG: Record<EmbedLang, { down: string; none: string; by: string }> = {
  fr: { down: "Horaires momentanément indisponibles.", none: "Aucun horaire publié pour aujourd'hui.", by: "Horaires fournis par" },
  en: { down: "Prayer times are temporarily unavailable.", none: "No times published for today.", by: "Times provided by" },
  ar: { down: "المواقيت غير متاحة حاليًا.", none: "لا توجد مواقيت منشورة لهذا اليوم.", by: "المواقيت مقدمة من" },
};

export default async function Embed({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ theme?: string | string[]; lang?: string | string[] }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!SLUG_RE.test(slug)) notFound();
  const theme = one(sp.theme) === "light" ? "light" : "dark";
  const l = one(sp.lang);
  const lang: EmbedLang = l === "ar" || l === "en" ? l : "fr";
  const m = MSG[lang];

  let body: React.ReactNode;
  let title: React.ReactNode = null;
  try {
    const mosque = await getMosque(slug);
    if (!mosque) notFound();
    const date = toIsoDate(new Date(), mosque.timezone);
    const [today, tomorrow] = await Promise.all([getDay(slug, date), getDay(slug, shiftIso(date, 1)).catch(() => null)]);
    const name = lang === "ar" && mosque.nameAr ? mosque.nameAr : mosque.name;
    title = (
      <div className="mb-2 min-w-0">
        <h1 className={`truncate font-medium ${lang === "ar" ? "font-ar text-xl" : "text-base"}`}>{name}</h1>
        {today && <p className="truncate text-xs text-muted">{longDate(today.date, LOCALES[lang])} · {lang === "ar" ? hijriAr(today.hijri) : hijriFr(today.hijri)}</p>}
      </div>
    );
    body = today
      ? <EmbedWidget slug={slug} version={mosque.version} timezone={mosque.timezone} today={today} tomorrow={tomorrow} initialNow={Date.now()} lang={lang} />
      : <p className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">{m.none}</p>;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    body = <p role="alert" className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">{m.down}</p>;
  }

  return (
    <div data-theme={theme} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-dvh flex-col bg-bg p-3 text-fg">
      {title}
      {body}
      <p className="mt-auto flex items-center justify-end gap-1.5 pt-2 text-[11px] text-muted">
        {m.by}
        <a href={`${SITE_URL}/m/${slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-gold2"><Logo size={14} /> Nidaa</a>
      </p>
    </div>
  );
}
