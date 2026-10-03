export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Nidaa" role="img">
      {/* Minaret carré (style mosquée Hamoudi) */}
      <rect x="10" y="22" width="14" height="34" rx="1" fill="#9a7a2f" />
      <rect x="8" y="18" width="18" height="5" rx="1" fill="#9a7a2f" />
      <rect x="12" y="12" width="10" height="7" rx="1" fill="#9a7a2f" />
      <path d="M17 4 L21 12 H13 Z" fill="#9a7a2f" />
      <rect x="15" y="30" width="4" height="7" rx="2" fill="#fbf7ec" />
      <rect x="15" y="42" width="4" height="7" rx="2" fill="#fbf7ec" />
      {/* Trois arcs rayonnant vers la droite */}
      <path d="M32 24 a14 14 0 0 1 0 20" stroke="#2c8c80" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M38 17 a22 22 0 0 1 0 34" stroke="#2c8c80" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M44 10 a30 30 0 0 1 0 48" stroke="#2c8c80" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={compact ? 28 : 36} />
      {!compact && (
        <div className="leading-tight">
          <div className="text-lg font-semibold tracking-tight text-stone-900">Nidaa</div>
          <div className="text-[11px] uppercase tracking-wider text-stone-500">Mosquée connectée</div>
        </div>
      )}
    </div>
  );
}
