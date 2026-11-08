import type { CSSProperties } from 'react';
import { season } from '../lib/season';

// Papel picado: a string of cut-paper flags across the top of the page for Día de Muertos.
const FLAGS = ['#D61F7A', '#F5A524', '#8B4FD8', '#1FB6A6', '#F0489C', '#F5A524'];

function Flag({ x, color, i }: { x: number; color: string; i: number }) {
  return (
    <g transform={`translate(${x} 2)`}>
      <g className="sway" style={{ animationDelay: `${-(i % 7) * 0.45}s` }}>
      <path d="M0 0h34v22l-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-2 2z" fill={color} />
      {/* the cut-outs: a little skull and petals */}
      <circle cx="17" cy="9" r="4.2" fill="#0B0D10" />
      <circle cx="15.4" cy="8.6" r="1" fill={color} />
      <circle cx="18.6" cy="8.6" r="1" fill={color} />
      <path d="M15.5 13.2h3v2.2h-3z" fill="#0B0D10" />
      <circle cx="6" cy="6" r="1.6" fill="#0B0D10" /><circle cx="28" cy="6" r="1.6" fill="#0B0D10" />
      <circle cx="6" cy="16" r="1.2" fill="#0B0D10" /><circle cx="28" cy="16" r="1.2" fill="#0B0D10" />
      </g>
    </g>
  );
}

export function PapelPicado() {
  if (season !== 'muertos') return null;
  return (
    <div aria-hidden className="pointer-events-none h-7 overflow-hidden border-b border-line/60">
      {/* two identical strings side by side, sliding left by one string's width: an endless loop */}
      <div className="picado flex w-max">
        {[0, 1].map((k) => (
          <svg key={k} className="h-7 w-[1680px] shrink-0" viewBox="0 0 1680 28">
            <path d="M0 2.5H1680" stroke="#F5A524" strokeOpacity=".5" />
            {Array.from({ length: 42 }, (_, i) => <Flag key={i} i={i} x={i * 40 + 3} color={FLAGS[i % FLAGS.length]} />)}
          </svg>
        ))}
      </div>
    </div>
  );
}

/** A line under a race's title for the race the festival falls on. */
export function SeasonNote({ country }: { country: string }) {
  if (season === 'diwali' && country === 'Brazil') return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-marigold/40 bg-marigold/10 px-3 py-1 text-sm font-semibold text-marigold">
      <span aria-hidden>🪔</span>Happy Diwali · Race night<span aria-hidden>🎆</span>
    </p>
  );
  if (season !== 'muertos' || country !== 'Mexico') return null;
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-marigold/40 bg-marigold/10 px-3 py-1 text-sm font-semibold text-marigold">
      <span aria-hidden>🎃</span>Halloween × Día de los Muertos<span aria-hidden>💀</span>
    </p>
  );
}

// ---------- Halloween night: bats, cobwebs and fog, behind the page's cards ----------

function Bat({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 28" className={className} style={style} fill="currentColor">
      <path d="M32 9c1.6-3 2.4-5 2.6-7.5L36 4.2l1.4-2.6c.6 2.6 1.2 4.4 2.6 6.4 4.6-4.6 11.6-6.8 22-4.4-4 2.4-6.2 5.4-6.6 9.6-3.6-1.8-7-1.4-9.6 1.4-2.2-1.6-4.2-1.6-5.8.6L32 27l-8-12.8c-1.6-2.2-3.6-2.2-5.8-.6-2.6-2.8-6-3.2-9.6-1.4-.4-4.2-2.6-7.2-6.6-9.6 10.4-2.4 17.4-.2 22 4.4 1.4-2 2-3.8 2.6-6.4L28 4.2l1.4-2.7C29.6 4 30.4 6 32 9z" />
    </svg>
  );
}

function Cobweb({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} fill="none" stroke="currentColor" strokeWidth="1">
      {[0, 22, 45, 68, 90].map((a) => (
        <line key={a} x1="0" y1="0" x2={160 * Math.cos((a * Math.PI) / 180)} y2={160 * Math.sin((a * Math.PI) / 180)} />
      ))}
      {[30, 58, 88, 120, 152].map((r) => (
        <path key={r} d={[0, 22, 45, 68, 90].map((a, i) => {
          const sag = i === 0 ? 1 : 0.86;
          const x = r * Math.cos((a * Math.PI) / 180), y = r * Math.sin((a * Math.PI) / 180);
          return `${i ? 'Q' + (r * sag * Math.cos(((a - 11) * Math.PI) / 180)).toFixed(1) + ' ' + (r * sag * Math.sin(((a - 11) * Math.PI) / 180)).toFixed(1) + ' ' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ')} />
      ))}
      <line x1="58" y1="58" x2="58" y2="96" strokeDasharray="2 2" />
      <circle cx="58" cy="100" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SpookyNight() {
  if (season !== 'muertos') return null;
  return (
    <div aria-hidden className="spooky pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <Cobweb className="absolute left-0 top-0 h-40 w-40 text-ink/[.13] sm:h-56 sm:w-56" />
      <Cobweb className="absolute right-0 top-0 h-40 w-40 -scale-x-100 text-ink/[.13] sm:h-56 sm:w-56" />
      <Bat className="bat absolute w-10 text-violet/70" style={{ top: '18%', animationDuration: '19s' }} />
      <Bat className="bat absolute w-6 text-ink/30" style={{ top: '34%', animationDuration: '27s', animationDelay: '-9s' }} />
      <Bat className="bat absolute w-8 text-marigold/40" style={{ top: '62%', animationDuration: '23s', animationDelay: '-15s' }} />
      <Bat className="bat absolute w-5 text-ink/25" style={{ top: '12%', animationDuration: '31s', animationDelay: '-4s' }} />
      <div className="fog absolute inset-x-[-20%] bottom-0 h-56" />
    </div>
  );
}

// ---------- Diwali: a marigold toran across the top; rangoli, fireworks, embers and a row of diyas behind the cards ----------

const BLOOMS = ['#F5A524', '#EA580C', '#FACC15', '#F5A524', '#D61F7A'];

function Bloom({ x, color, i }: { x: number; color: string; i: number }) {
  const hangs = i % 4 === 2; // every fourth bloom carries a small lantern
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="sway" style={{ animationDelay: `${-(i % 7) * 0.45}s` }}>
        <path d="M-5 3c-5 4-6 9-4 13 3-2 5-7 4-13zM5 3c5 4 6 9 4 13-3-2-5-7-4-13z" fill="#3F8F4F" />
        {Array.from({ length: 10 }, (_, p) => (
          <circle key={p} cx={6 * Math.cos((p * Math.PI) / 5)} cy={9 + 6 * Math.sin((p * Math.PI) / 5)} r="3" fill={color} />
        ))}
        <circle cy="9" r="3.4" fill="#FDE68A" />
        {hangs && <>
          <path d="M0 16v7" stroke="#F5A524" />
          <path d="M-5 23h10l2 5-2 5H-5l-2-5z" fill="#D94811" />
          <path d="M-3 25.5h6M-3 30.5h6" stroke="#FDE68A" />
        </>}
      </g>
    </g>
  );
}

function Toran() {
  return (
    <div aria-hidden className="pointer-events-none h-10 overflow-hidden border-b border-line/60">
      <div className="picado flex w-max">
        {[0, 1].map((k) => (
          <svg key={k} className="h-10 w-[1680px] shrink-0" viewBox="0 0 1680 40">
            <path d="M0 3H1680" stroke="#F5A524" strokeOpacity=".6" />
            {Array.from({ length: 42 }, (_, i) => <Bloom key={i} i={i} x={i * 40 + 20} color={BLOOMS[i % BLOOMS.length]} />)}
          </svg>
        ))}
      </div>
    </div>
  );
}

function Rangoli({ className }: { className: string }) {
  const turns = (n: number) => Array.from({ length: n }, (_, i) => (i * 360) / n);
  return (
    <svg viewBox="-100 -100 200 200" className={className}>
      {turns(8).map((a) => <path key={a} transform={`rotate(${a})`} d="M0-92C18-70 18-48 0-34-18-48-18-70 0-92z" fill="#EA580C" fillOpacity=".55" />)}
      {turns(8).map((a) => <path key={a} transform={`rotate(${a + 22.5})`} d="M0-66C12-52 12-40 0-30-12-40-12-52 0-66z" fill="#D61F7A" fillOpacity=".55" />)}
      {turns(16).map((a) => <circle key={a} transform={`rotate(${a})`} cy="-26" r="4" fill="#FACC15" fillOpacity=".7" />)}
      <circle r="17" fill="#F5A524" fillOpacity=".6" /><circle r="8" fill="#FDE68A" fillOpacity=".8" />
    </svg>
  );
}

function Burst({ className, color, style }: { className: string; color: string; style?: CSSProperties }) {
  return (
    <svg viewBox="-60 -60 120 120" className={`burst absolute ${className}`} style={style}>
      {Array.from({ length: 16 }, (_, i) => (i * 360) / 16).map((a, i) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d={`M0-16V-${i % 2 ? 40 : 50}`} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <circle cy={i % 2 ? -44 : -55} r="1.9" fill={color} />
        </g>
      ))}
    </svg>
  );
}

function Diya({ i }: { i: number }) {
  return (
    <svg viewBox="0 0 48 44" className="h-9 w-10 shrink-0 sm:h-11 sm:w-12">
      <ellipse className="flame-glow" cx="24" cy="15" rx="14" ry="14" fill="#F5A524" fillOpacity=".3" style={{ animationDelay: `${-i * 0.37}s` }} />
      <path className="flame" d="M24 4c5 7 6 11 3 15-2 2-4 2-6 0-3-4-2-8 3-15z" fill="#FACC15" style={{ animationDelay: `${-i * 0.37}s` }} />
      <path d="M4 24h40c-1 11-9 17-20 17S5 35 4 24z" fill="#B4430F" />
      <path d="M4 24h40l-1 4H5z" fill="#F5A524" /><path d="M12 34h24" stroke="#FDE68A" strokeOpacity=".6" strokeDasharray="2 4" />
    </svg>
  );
}

function DiwaliNight() {
  return (
    <div aria-hidden className="diwali-night pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <Rangoli className="rangoli absolute -left-20 -top-20 h-56 w-56 opacity-30 sm:h-80 sm:w-80" />
      <Rangoli className="rangoli absolute -right-20 -top-20 h-56 w-56 opacity-30 sm:h-80 sm:w-80" />
      <Burst className="left-[12%] top-[16%] w-32 sm:w-44" color="#FACC15" />
      <Burst className="right-[10%] top-[28%] w-28 sm:w-52" color="#F0489C" style={{ animationDelay: '-2.2s' }} />
      <Burst className="left-[44%] top-[9%] w-24 sm:w-36" color="#FB923C" style={{ animationDelay: '-4.1s' }} />
      <Burst className="left-[28%] top-[52%] w-24 sm:w-40" color="#A78BFA" style={{ animationDelay: '-5.6s' }} />
      {[6, 17, 29, 41, 53, 66, 78, 91].map((left, i) => (
        <span key={left} className="ember absolute bottom-10 h-1 w-1 rounded-full bg-marigold" style={{ left: `${left}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${11 + (i % 3) * 3}s` }} />
      ))}
      <div className="diya-glow absolute inset-x-0 bottom-0 h-40" />
      <div className="absolute inset-x-0 bottom-1 flex justify-around opacity-40 sm:opacity-70">
        {Array.from({ length: 12 }, (_, i) => <span key={i} className={i % 2 ? 'hidden sm:block' : ''}><Diya i={i} /></span>)}
      </div>
    </div>
  );
}

/** The strip under the navbar for whichever festival is on. */
export function SeasonBanner() {
  return season === 'diwali' ? <Toran /> : <PapelPicado />;
}

/** The decorations behind the page for whichever festival is on. */
export function SeasonBackdrop() {
  return season === 'diwali' ? <DiwaliNight /> : <SpookyNight />;
}
