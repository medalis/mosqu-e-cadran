"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Brand } from "./Logo";
import { Badge } from "./ui";
import { cn, STATUS_LABEL, STATUS_TONE } from "@/lib/utils";
import { rememberMosque } from "@/lib/nav";

const MOSQUE_NAV = [
  { href: "", label: "Tableau de bord", icon: "▦" },
  { href: "/mosque", label: "Fiche mosquée", icon: "🕌" },
  { href: "/times", label: "Horaires", icon: "◷" },
  { href: "/iqama", label: "Iqama et Jumu'a", icon: "☾" },
  { href: "/announcements", label: "Annonces", icon: "✦" },
  { href: "/screens", label: "Écrans", icon: "▭" },
  { href: "/team", label: "Équipe", icon: "⚇" },
  { href: "/audit", label: "Journal", icon: "≣" },
];
const SUPER_NAV = [
  { href: "/super/validation", label: "Validation", icon: "✓" },
  { href: "/super/content", label: "Contenus", icon: "❝" },
  { href: "/super/stats", label: "Statistiques", icon: "∑" },
];

export function Shell({ children, mosqueId }: { children: ReactNode; mosqueId?: string }) {
  const { me, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const base = mosqueId ? `/m/${mosqueId}` : null;
  const membership = me?.memberships.find((m) => m.mosqueId === mosqueId);

  // Le tableau de bord (href === base) n'est actif que sur sa page exacte ; les sous-pages le sont aussi sur leurs enfants.
  const isActive = (href: string) => (base && href === base ? pathname === base : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-stone-200 bg-white transition-transform lg:static lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center border-b border-stone-100 px-5"><Link href="/" onClick={() => setOpen(false)}><Brand /></Link></div>
        <nav className="flex flex-col gap-6 p-3 text-sm">
          {base && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Ma mosquée</div>
              {MOSQUE_NAV.map((it) => {
                const href = `${base}${it.href}`;
                return <NavLink key={href} href={href} active={isActive(href)} icon={it.icon} onClick={() => setOpen(false)}>{it.label}</NavLink>;
              })}
            </div>
          )}
          {me?.isSuperAdmin && (
            <div>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Plateforme</div>
              {SUPER_NAV.map((it) => <NavLink key={it.href} href={it.href} active={isActive(it.href)} icon={it.icon} onClick={() => setOpen(false)}>{it.label}</NavLink>)}
            </div>
          )}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-stone-900/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded p-2 text-stone-600 hover:bg-stone-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
          {me && me.memberships.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={mosqueId ?? ""}
                onChange={(e) => { const id = e.target.value; if (!id) return; rememberMosque(id); const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : ""; router.push(`/m/${id}${rest}`); }}
                className="h-9 max-w-[16rem] truncate rounded-md border border-stone-300 bg-white px-2 text-sm font-medium text-stone-800 focus:border-gold-500 focus:outline-none"
                aria-label="Changer de mosquée"
              >
                {!mosqueId && <option value="">Choisir une mosquée…</option>}
                {me.memberships.map((m) => <option key={m.mosqueId} value={m.mosqueId}>{m.mosqueName}</option>)}
              </select>
              {membership && <Badge tone={STATUS_TONE[membership.status]} className="hidden sm:inline-flex">{STATUS_LABEL[membership.status]}</Badge>}
            </div>
          )}
          <Link href="/onboarding" className="hidden text-xs text-stone-500 hover:text-gold-700 sm:inline">+ Nouvelle mosquée</Link>
          <div className="ml-auto"><UserMenu name={me?.fullName ?? ""} email={me?.email ?? ""} isSuper={!!me?.isSuperAdmin} onLogout={async () => { await signOut(); router.replace("/login"); }} /></div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">{children}</div></main>
      </div>
    </div>
  );
}

function NavLink({ href, active, icon, children, onClick }: { href: string; active: boolean; icon: string; children: ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={cn("flex items-center gap-3 rounded-md px-3 py-2 font-medium transition", active ? "bg-gold-50 text-gold-800" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900")}>
      <span className={cn("w-5 text-center text-base", active ? "text-gold-600" : "text-stone-400")} aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}

function UserMenu({ name, email, isSuper, onLogout }: { name: string; email: string; isSuper: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-3 text-sm hover:bg-stone-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">{initials}</span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-lg border border-stone-200 bg-white p-1 text-sm shadow-lg">
          <div className="px-3 py-2">
            <div className="font-medium text-stone-900">{name}</div>
            <div className="truncate text-xs text-stone-500">{email}</div>
            {isSuper && <Badge tone="gold" className="mt-1">Super-administrateur</Badge>}
          </div>
          <div className="my-1 border-t border-stone-100" />
          <Link href="/onboarding" onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-stone-700 hover:bg-stone-100">Créer une mosquée</Link>
          <button onClick={onLogout} className="block w-full rounded px-3 py-2 text-left text-red-700 hover:bg-red-50">Se déconnecter</button>
        </div>
      )}
    </div>
  );
}
