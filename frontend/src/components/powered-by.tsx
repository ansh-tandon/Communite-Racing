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

/** `lg`: the big version at the top of the sign-in page. */
export function PoweredBy({ size = 'sm', className = '' }: { size?: 'sm' | 'lg'; className?: string }) {
  const lg = size === 'lg';
  return (
    <a href="https://matchnight.in" target="_blank" rel="noopener noreferrer" aria-label="Powered by matchnight (opens matchnight.in)"
      className={`group flex items-center rounded-full border transition-colors ${lg
        ? 'gap-3.5 border-white/15 bg-black/40 px-5 py-2.5 text-white/70 backdrop-blur-sm hover:border-white/35 hover:text-white sm:gap-4 sm:px-6 sm:py-3'
        : 'mx-auto w-fit gap-3 border-line px-4 py-2 text-muted hover:border-ink/30 hover:text-ink'} ${className}`}>
      <span className={`uppercase ${lg ? 'text-[11px] tracking-[0.18em] sm:text-xs' : 'text-xs tracking-[0.14em]'}`}>Powered by</span>
      <span className={`flex items-center text-white ${lg ? 'gap-2.5' : 'gap-2'}`}>
        <Floodlight className={`shrink-0 ${lg ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-5 w-5'}`} />
        <span className={`font-display font-bold lowercase tracking-[0.04em] ${lg ? 'text-[1.6rem] leading-none sm:text-[1.9rem]' : 'text-[1.05rem]'}`}>matchnight</span>
      </span>
    </a>
  );
}
