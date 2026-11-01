import type { CSSProperties } from 'react';
import { season } from '../lib/season';

// Papel picado: a string of cut-paper flags across the top of the page for Día de Muertos.
const FLAGS = ['#D61F7A', '#F5A524', '#8B4FD8', '#1FB6A6', '#F0489C', '#F5A524'];

function Flag({ x, color }: { x: number; color: string }) {
  return (
    <g transform={`translate(${x} 2)`}>
      <path d="M0 0h34v22l-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-2 2z" fill={color} />
      {/* the cut-outs: a little skull and petals */}
      <circle cx="17" cy="9" r="4.2" fill="#0B0D10" />
      <circle cx="15.4" cy="8.6" r="1" fill={color} />
      <circle cx="18.6" cy="8.6" r="1" fill={color} />
      <path d="M15.5 13.2h3v2.2h-3z" fill="#0B0D10" />
      <circle cx="6" cy="6" r="1.6" fill="#0B0D10" /><circle cx="28" cy="6" r="1.6" fill="#0B0D10" />
      <circle cx="6" cy="16" r="1.2" fill="#0B0D10" /><circle cx="28" cy="16" r="1.2" fill="#0B0D10" />
    </g>
  );
}

export function PapelPicado() {
  if (season !== 'muertos') return null;
  return (
    <div aria-hidden className="pointer-events-none h-7 overflow-hidden border-b border-line/60">
      <svg className="h-7 w-full" preserveAspectRatio="xMinYMin slice" viewBox="0 0 1600 30">
        <path d="M0 2.5H1600" stroke="#F5A524" strokeOpacity=".5" />
        {Array.from({ length: 40 }, (_, i) => <Flag key={i} x={i * 40 + 3} color={FLAGS[i % FLAGS.length]} />)}
      </svg>
    </div>
  );
}

/** A line under a race's title for the Mexico City GP during Día de Muertos. */
export function MuertosNote({ country }: { country: string }) {
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
