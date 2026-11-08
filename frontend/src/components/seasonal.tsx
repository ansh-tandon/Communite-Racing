import { useId, type CSSProperties } from 'react';
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

// ---------- Diwali: a string of warm lights, one fine-line mandala, a few soft bursts and a row of small diyas ----------

// One 1680 x 28 tile of warm lights on a thin cord, repeated side by side and drifting. The bulbs sit in three
// separate layers that fade in turn: fading a whole layer is cheap on a phone, fading each bulb is not.
const STRING = { viewBox: '0 0 1680 28', className: 'absolute inset-0 h-full w-full' };
const SPAN = 140; // one drooping length of cord
const BULB_LAYERS: { x: number; y: number }[][] = [[], [], []];
for (let s = 0; s < 1680 / SPAN; s++) {
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    BULB_LAYERS[(s * 7 + i) % 3].push({ x: s * SPAN + SPAN * t, y: 3 + 60 * t * (1 - t) });
  }
}

function LightsTile() {
  return (
    <div className="relative h-7 w-[1680px] shrink-0">
      <svg {...STRING}>
        {Array.from({ length: 1680 / SPAN }, (_, s) => <path key={s} d={`M${s * SPAN} 3Q${s * SPAN + SPAN / 2} 33 ${(s + 1) * SPAN} 3`} fill="none" stroke="#FFD166" strokeOpacity=".3" />)}
      </svg>
      {BULB_LAYERS.map((layer, k) => (
        <svg key={k} {...STRING} className={`${STRING.className} twinkle`} style={{ animationDelay: `${-k * 0.9}s` }}>
          {layer.map((l, i) => (
            <g key={i}>
              <circle cx={l.x} cy={l.y} r="4.5" fill="#FFC53D" fillOpacity=".22" />
              <circle cx={l.x} cy={l.y} r="1.8" fill="#FFE9A8" />
            </g>
          ))}
        </svg>
      ))}
    </div>
  );
}

function StringLights() {
  return (
    <div aria-hidden className="pointer-events-none h-7 overflow-hidden">
      <div className="picado flex w-max"><LightsTile /><LightsTile /></div>
    </div>
  );
}

function Burst({ colors }: { colors: [string, string] }) {
  const glow = `glow${useId()}`;
  return (
    <svg viewBox="-70 -70 140 140" className="block w-full overflow-visible">
      <defs><radialGradient id={glow}><stop offset="0" stopColor={colors[1]} stopOpacity=".3" /><stop offset="1" stopColor={colors[0]} stopOpacity="0" /></radialGradient></defs>
      <circle r="60" fill={`url(#${glow})`} />
      {Array.from({ length: 22 }, (_, i) => {
        const reach = 44 + ((i * 7) % 5) * 4;
        return (
          <g key={i} transform={`rotate(${(i * 360) / 22})`}>
            <circle cy={-reach * 0.65} r="1.1" fill={colors[1]} fillOpacity=".6" />
            <circle cy={-reach} r="1.9" fill={colors[0]} />
          </g>
        );
      })}
    </svg>
  );
}

// one soft burst at a time, in warm colours
const SKY: { at: string; colors: [string, string] }[] = [
  { at: 'left-[5%] top-[22%] w-24 sm:w-36', colors: ['#FACC15', '#FFF1B8'] },
  { at: 'right-[6%] top-[38%] w-24 sm:w-40', colors: ['#FFB347', '#FFE9A8'] },
  { at: 'left-[34%] top-[60%] w-20 sm:w-32', colors: ['#FF8FB3', '#FFE9A8'] },
];

function Diya({ i }: { i: number }) {
  const delay = { animationDelay: `${-i * 0.37}s` };
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 overflow-visible sm:h-8 sm:w-8">
      <circle className="flame-glow" cx="16" cy="12" r="11" fill="#FFB347" fillOpacity=".24" style={delay} />
      <g className="flame" style={delay}>
        <path d="M16 3c4 5 5 8 3 11-1.6 1.6-4.4 1.6-6 0-2-3-1-6 3-11z" fill="#FFC53D" />
        <path d="M16 8c1.8 2.6 2.2 4.3 1.2 6h-2.4c-1-1.7-.6-3.4 1.2-6z" fill="#FFF7D6" />
      </g>
      <path d="M5 19h22c-.8 6-5.3 9.5-11 9.5S5.8 25 5 19z" fill="#C2410C" />
      <path d="M5 19h22" stroke="#FFD166" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** One large mandala drawn in fine gold line, turning very slowly behind the page. */
function Mandala() {
  const turns = (n: number) => Array.from({ length: n }, (_, i) => (i * 360) / n);
  return (
    <svg viewBox="-104 -104 208 208" className="mandala absolute -right-40 top-28 h-[340px] w-[340px] opacity-30 sm:-right-32 sm:top-24 sm:h-[620px] sm:w-[620px] sm:opacity-[.16]" fill="none" stroke="#E8B65A" strokeWidth=".45">
      <circle r="102" /><circle r="98" /><circle r="56" /><circle r="36" /><circle r="14" />
      {turns(24).map((a) => <path key={a} transform={`rotate(${a})`} d="M0-98C10-84 10-70 0-58-10-70-10-84 0-98z" />)}
      {turns(24).map((a) => <circle key={a} transform={`rotate(${a + 7.5})`} cy="-92" r="1.3" fill="#E8B65A" stroke="none" />)}
      {turns(16).map((a) => <path key={a} transform={`rotate(${a})`} d="M0-55C8-48 8-42 0-37-8-42-8-48 0-55z" />)}
      {turns(32).map((a) => <circle key={a} transform={`rotate(${a})`} cy="-30" r=".9" fill="#E8B65A" stroke="none" />)}
      {turns(8).map((a) => <path key={a} transform={`rotate(${a})`} d="M0-25C6-21 6-17 0-14-6-17-6-21 0-25z" />)}
    </svg>
  );
}

function DiwaliNight({ front }: { front: boolean }) {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden"><Mandala /></div>
      {/* inside the app the cards fill a phone's screen, so the bursts go over them (taps pass straight through) */}
      <div aria-hidden className={`pointer-events-none fixed inset-0 overflow-hidden ${front ? 'z-[2]' : 'z-0'}`}>
        {SKY.map((f, i) => (
          <div key={f.at} className={`absolute ${f.at}`}>
            <div className="burst-wrap" style={{ animationDelay: `${-i * 4}s` }}><Burst colors={f.colors} /></div>
          </div>
        ))}
      </div>
      {/* on a phone the diyas stand on top of the tab bar, which would otherwise hide them */}
      <div aria-hidden className={`pointer-events-none fixed inset-x-0 flex justify-center gap-8 pb-1.5 sm:gap-14 ${front ? 'bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 bg-bg md:bottom-0 md:z-0 md:bg-transparent [html[data-keyboard=open]_&]:hidden' : 'bottom-0 z-0 hidden md:flex'}`}>
        {Array.from({ length: 7 }, (_, i) => <span key={i} className={i > 4 ? 'hidden md:block' : ''}><Diya i={i} /></span>)}
      </div>
    </>
  );
}

/** The strip under the navbar for whichever festival is on. */
export function SeasonBanner() {
  return season === 'diwali' ? <StringLights /> : <PapelPicado />;
}

/** The decorations behind the page for whichever festival is on. */
export function SeasonBackdrop({ front = false }: { front?: boolean }) {
  return season === 'diwali' ? <DiwaliNight front={front} /> : <SpookyNight />;
}
