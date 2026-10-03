import Link from "next/link";
import { Brand } from "@/components/Logo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="sky" aria-hidden="true" />
      <div className="pattern" aria-hidden="true" />
      <a href="#contenu" className="btn btn-gold sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">Aller au contenu</a>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-5">
          <Link href="/" aria-label="Nidaa — accueil" className="rounded-lg"><Brand /></Link>
          <nav aria-label="Navigation principale">
            <Link href="/" className="whitespace-nowrap text-sm text-muted transition-colors hover:text-fg">Trouver une mosquée</Link>
          </nav>
        </header>
        <main id="contenu" className="flex-1 pb-16">{children}</main>
        <footer className="border-t border-line py-6 text-sm text-muted">
          <p>Nidaa — les horaires affichés sont ceux communiqués par chaque mosquée. Sans publicité.</p>
        </footer>
      </div>
    </>
  );
}
