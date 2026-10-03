/** Logo Nidaa : minaret carré (style Hamoudi) + trois arcs, l'appel qui se propage. Défini une fois en <symbol>, réutilisé via <use>. */
export function LogoDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="logo" viewBox="0 0 64 64">
          <path d="M14 58V24h14v34z" fill="var(--gold)" />
          <path d="M12 24h18l-2-5H14z" fill="var(--gold2)" />
          <path d="M17 19l4-9 4 9z" fill="var(--gold2)" />
          <circle cx="21" cy="8" r="2" fill="var(--gold2)" />
          <path d="M18 58V44h6v14z" fill="var(--bg)" opacity=".5" />
          <path d="M36 31a9 9 0 0 1 0 12" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
          <path d="M41 25a17 17 0 0 1 0 24" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" opacity=".7" />
          <path d="M46 19a25 25 0 0 1 0 36" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" opacity=".4" />
        </symbol>
      </defs>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href="#logo" />
    </svg>
  );
}
