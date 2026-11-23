// "Powered by matchnight", with matchnight's logo: "Floodlight", a bank of nine stadium lamps with one lit red.
// Same drawing as matchnight.in's logo (Startup/website/src/components/Logo.astro).

const LAMPS = [[6, 6], [24, 6], [42, 6], [6, 24], [24, 24], [42, 24], [6, 42], [24, 42], [42, 42]] as const;

function Floodlight({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      {LAMPS.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="16" height="16" rx="4.5" fill={i === 2 ? '#FF2233' : 'currentColor'} className={i === 2 ? 'mn-live' : undefined} />
      ))}
    </svg>
  );
}

/** The sign-in page's co-brand lockup: a small "POWERED BY" over the logo and wordmark, no box, right-aligned. */
export function PoweredByLockup({ className = '' }: { className?: string }) {
  return (
    <a href="https://matchnight.in" target="_blank" rel="noopener noreferrer" aria-label="Powered by matchnight (opens matchnight.in)"
      className={`group flex flex-col items-end gap-1.5 text-white transition-opacity hover:opacity-80 ${className}`}>
      <span className="text-[9px] font-semibold uppercase leading-none tracking-[0.32em] text-white/50 sm:text-[10px]">Powered by</span>
      <span className="flex items-center gap-2 sm:gap-2.5">
        <Floodlight className="h-[22px] w-[22px] shrink-0 sm:h-7 sm:w-7" />
        <span className="font-display text-[1.3rem] font-bold lowercase leading-none tracking-[0.03em] sm:text-[1.65rem]">matchnight</span>
      </span>
    </a>
  );
}

export function PoweredBy() {
  return (
    <a href="https://matchnight.in" target="_blank" rel="noopener noreferrer"
      className="group mx-auto flex w-fit items-center gap-3 rounded-full border border-line px-4 py-2 text-muted transition-colors hover:border-ink/30 hover:text-ink">
      <span className="text-xs uppercase tracking-[0.14em]">Powered by</span>
      <span className="flex items-center gap-2 text-ink">
        <Floodlight className="h-5 w-5 shrink-0" />
        <span className="font-display text-[1.05rem] font-bold lowercase tracking-[0.04em]">matchnight</span>
      </span>
    </a>
  );
}
