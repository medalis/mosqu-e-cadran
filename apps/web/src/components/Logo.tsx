/** Logo Nidaa (repris du back-office, couleurs de la charte « nuit »). */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <rect x="10" y="22" width="14" height="34" rx="1" fill="var(--gold)" />
      <rect x="8" y="18" width="18" height="5" rx="1" fill="var(--gold2)" />
      <rect x="12" y="12" width="10" height="7" rx="1" fill="var(--gold)" />
      <path d="M17 4 L21 12 H13 Z" fill="var(--gold2)" />
      <rect x="15" y="30" width="4" height="7" rx="2" fill="var(--bg)" />
      <rect x="15" y="42" width="4" height="7" rx="2" fill="var(--bg)" />
      <path d="M32 24 a14 14 0 0 1 0 20" stroke="var(--teal)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M38 17 a22 22 0 0 1 0 34" stroke="var(--teal)" strokeWidth="3.5" strokeLinecap="round" opacity=".7" />
      <path d="M44 10 a30 30 0 0 1 0 48" stroke="var(--teal)" strokeWidth="3.5" strokeLinecap="round" opacity=".4" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={34} />
      <span className="leading-tight">
        <span className="block text-lg font-semibold tracking-tight text-fg">Nidaa <span lang="ar" dir="rtl" className="font-ar text-gold2">نداء</span></span>
        <span className="block text-[11px] uppercase tracking-[.16em] text-muted">Mosquée connectée</span>
      </span>
    </span>
  );
}
