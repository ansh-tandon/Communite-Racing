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

// ---------- Diwali: a night scene strung with lights across the top; rangoli, fireworks, embers and a row of diyas behind the cards ----------

// One 1680 x 96 tile of a Diwali night, repeated side by side and drifting. The lights sit in three separate
// layers that fade in turn: fading a whole layer is cheap on a phone, fading each bulb is not.
const SCENE = { viewBox: '0 0 1680 96', className: 'absolute inset-0 h-full w-full' };
const BULBS = ['#FFD166', '#FFB347', '#FF6FA8', '#7DE3F4', '#FFF1B8'];
const SWAG = 210; // one drooping string of lights

type Building = { x: number; w: number; h: number; temple?: boolean };
const BUILDINGS: Building[] = [
  { x: 30, w: 130, h: 34 }, { x: 186, w: 66, h: 50, temple: true }, { x: 280, w: 170, h: 28 }, { x: 492, w: 96, h: 40 },
  { x: 616, w: 66, h: 54, temple: true }, { x: 712, w: 150, h: 32 }, { x: 896, w: 120, h: 42 }, { x: 1046, w: 66, h: 52, temple: true },
  { x: 1146, w: 160, h: 30 }, { x: 1336, w: 100, h: 40 }, { x: 1466, w: 66, h: 48, temple: true }, { x: 1560, w: 100, h: 30 },
];

const onion = (cx: number, top: number, r: number) =>
  `M${cx - r} ${top}C${cx - r} ${top - r * 1.3} ${cx - 2} ${top - r * 1.3} ${cx} ${top - r * 2}C${cx + 2} ${top - r * 1.3} ${cx + r} ${top - r * 1.3} ${cx + r} ${top}z`;

function buildingShape({ x, w, h, temple }: Building) {
  const top = 96 - h, cx = x + w / 2;
  if (temple) return `M${x} 96V${top + 14}L${cx - 12} ${top}Q${cx} ${top - 26} ${cx + 12} ${top}L${x + w} ${top + 14}V96z`;
  return `M${x} 96V${top}H${x + w}V96z ${onion(cx, top, w / 6)} ${onion(x + 14, top, 8)} ${onion(x + w - 14, top, 8)}`;
}

type Bulb = { x: number; y: number; c: string; halo: boolean };
const SCENE_LIGHTS: Bulb[][] = [[], [], []];
let bulbNo = 0;
const addBulb = (x: number, y: number, halo: boolean) => {
  SCENE_LIGHTS[bulbNo % 3].push({ x, y, c: BULBS[bulbNo % BULBS.length], halo });
  bulbNo += 1;
};
for (let s = 0; s < 1680 / SWAG; s++) {
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    addBulb(s * SWAG + SWAG * t, 3 + 104 * t * (1 - t), true);
  }
}
for (const b of BUILDINGS) {
  const top = 96 - b.h;
  for (let x = b.x + 3; x < b.x + b.w; x += 9) if (!b.temple) addBulb(x, top, false);
  for (let y = top + 8; y < 92; y += 9) { addBulb(b.x + 1, y, false); addBulb(b.x + b.w - 1, y, false); }
}

const WINDOWS = BUILDINGS.flatMap((b) => {
  const cols = Math.floor((b.w - 16) / 16), out: { x: number; y: number }[] = [];
  for (let y = 96 - b.h + 10; y < 84; y += 15)
    for (let c = 0; c < cols; c++) out.push({ x: b.x + 12 + c * 16, y });
  return out;
});

/** Akash kandil: a paper sky lantern hanging where two strings of lights meet. */
function Kandil({ x, color }: { x: number; color: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <circle cy="26" r="17" fill={color} fillOpacity=".28" />
      <path d="M0 3v11" stroke="#FFD166" />
      <path d="M0 14l9 12-9 12-9-12z" fill={color} />
      <path d="M-9 26H9M0 14v24" stroke="#FFF1B8" strokeOpacity=".8" />
      <path d="M-3 38v9M0 38v12M3 38v9" stroke={color} />
    </g>
  );
}

const SPARKLES = [{ x: 150, y: 24, c: '#FF6FA8' }, { x: 600, y: 20, c: '#7DE3F4' }, { x: 1010, y: 26, c: '#FFD166' }, { x: 1430, y: 22, c: '#C9A6FF' }];

function SceneTile() {
  return (
    <div className="relative h-16 w-[1120px] shrink-0 sm:h-24 sm:w-[1680px]">
      <svg {...SCENE}>
        {Array.from({ length: 46 }, (_, i) => <circle key={i} cx={(i * 367) % 1680} cy={6 + ((i * 53) % 44)} r={i % 5 ? 0.7 : 1.2} fill="#FFF1B8" fillOpacity=".7" />)}
        <rect y="90" width="1680" height="6" fill="#0D0618" />
        {BUILDINGS.map((b) => <path key={b.x} d={buildingShape(b)} fill="#120822" />)}
        {WINDOWS.map((w, i) => <rect key={i} x={w.x} y={w.y} width="5" height="8" rx="2.5" fill={i % 4 === 3 ? '#FF9F43' : '#FFC53D'} fillOpacity=".9" />)}
        {Array.from({ length: 8 }, (_, s) => <path key={s} d={`M${s * SWAG} 3Q${s * SWAG + SWAG / 2} 55 ${(s + 1) * SWAG} 3`} fill="none" stroke="#FFD166" strokeOpacity=".35" />)}
        {Array.from({ length: 8 }, (_, s) => <Kandil key={s} x={s * SWAG + (s % 2 ? 0 : SWAG / 2) + 18} color={['#FF3D81', '#FF8A00', '#22D3EE', '#FFC53D'][s % 4]} />)}
      </svg>
      {SCENE_LIGHTS.map((layer, k) => (
        <svg key={k} {...SCENE} className={`${SCENE.className} twinkle`} style={{ animationDelay: `${-k * 0.55}s` }}>
          {layer.map((l, i) => (
            <g key={i}>
              {l.halo && <circle cx={l.x} cy={l.y} r="6.5" fill={l.c} fillOpacity=".3" />}
              <circle cx={l.x} cy={l.y} r={l.halo ? 2.6 : 1.7} fill={l.c} />
            </g>
          ))}
          {SPARKLES.filter((_, i) => i % 3 === k).map((p) => (
            <g key={p.x} transform={`translate(${p.x} ${p.y})`}>
              {Array.from({ length: 12 }, (_, r) => <circle key={r} transform={`rotate(${r * 30})`} cy={r % 2 ? -10 : -14} r="1.5" fill={p.c} />)}
              <circle r="2.4" fill="#FFFFFF" />
            </g>
          ))}
        </svg>
      ))}
    </div>
  );
}

function DiwaliScene() {
  return (
    <div aria-hidden className="diwali-scene pointer-events-none h-16 overflow-hidden border-b border-marigold/30 sm:h-24">
      <div className="picado flex w-max"><SceneTile /><SceneTile /></div>
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

function Burst({ colors }: { colors: [string, string] }) {
  const glow = `glow${useId()}`;
  return (
    <svg viewBox="-70 -70 140 140" className="block w-full overflow-visible">
      <defs><radialGradient id={glow}><stop offset="0" stopColor={colors[1]} stopOpacity=".5" /><stop offset="1" stopColor={colors[0]} stopOpacity="0" /></radialGradient></defs>
      <circle r="66" fill={`url(#${glow})`} />
      {Array.from({ length: 28 }, (_, i) => {
        const reach = 44 + ((i * 7) % 5) * 5;
        return (
          <g key={i} transform={`rotate(${(i * 360) / 28 + (i % 3) * 3})`}>
            <circle cy={-reach * 0.5} r="1.1" fill={colors[1]} fillOpacity=".5" />
            <circle cy={-reach * 0.75} r="1.6" fill={colors[i % 4 ? 0 : 1]} fillOpacity=".75" />
            <circle cy={-reach} r="2.5" fill={colors[0]} />
            <circle cy={-reach} r="1" fill="#FFFFFF" />
          </g>
        );
      })}
      <circle r="4" fill="#FFFFFF" />
    </svg>
  );
}

// where each firework goes off; the first five are all a phone has room for
const SKY: { at: string; colors: [string, string] }[] = [
  { at: 'left-[3%] top-[13%] w-40 sm:w-60', colors: ['#FACC15', '#FF3D81'] },
  { at: 'right-[2%] top-[27%] w-44 sm:w-64', colors: ['#22D3EE', '#FDE047'] },
  { at: 'left-[24%] top-[43%] w-36 sm:w-52', colors: ['#FF3D81', '#FB923C'] },
  { at: 'right-[8%] top-[60%] w-40 sm:w-56', colors: ['#A3E635', '#F0ABFC'] },
  { at: 'left-[2%] top-[68%] w-36 sm:w-52', colors: ['#FB923C', '#22D3EE'] },
  { at: 'hidden sm:block left-[44%] top-[10%] w-52', colors: ['#F0ABFC', '#FACC15'] },
  { at: 'hidden sm:block left-[66%] top-[42%] w-48', colors: ['#FDE047', '#FF3D81'] },
  { at: 'hidden sm:block left-[40%] top-[70%] w-52', colors: ['#22D3EE', '#A3E635'] },
];

function Firework({ at, colors, i }: { at: string; colors: [string, string]; i: number }) {
  const delay = { animationDelay: `${-i * 1.37}s` };
  return (
    <div className={`absolute ${at}`}>
      <span className="rocket absolute left-1/2 top-1/2 h-12 w-[3px] rounded-full" style={{ ...delay, background: `linear-gradient(${colors[1]}, transparent)` }} />
      <div style={delay} className="burst-wrap"><Burst colors={colors} /></div>
    </div>
  );
}

function Diya({ i }: { i: number }) {
  const delay = { animationDelay: `${-i * 0.37}s` };
  return (
    <svg viewBox="0 0 56 56" className="h-11 w-11 shrink-0 overflow-visible sm:h-14 sm:w-14">
      <circle className="flame-glow" cx="28" cy="20" r="22" fill="#F59E0B" fillOpacity=".35" style={delay} />
      <circle className="flame-glow" cx="28" cy="21" r="13" fill="#FDE047" fillOpacity=".45" style={delay} />
      <g className="flame" style={delay}>
        <path d="M28 2c8 10 10 17 5 25-3 3-7 3-10 0-5-8-3-15 5-25z" fill="#FF7A00" />
        <path d="M28 9c5 7 6 12 3 17-2 2-4 2-6 0-3-5-2-10 3-17z" fill="#FFD60A" />
        <path d="M28 17c2 3 3 6 1 9h-2c-2-3-1-6 1-9z" fill="#FFFFFF" />
      </g>
      <path d="M5 33h46c-1 13-11 21-23 21S6 46 5 33z" fill="#E8590C" />
      <path d="M5 33h46l-1 5H6z" fill="#FFC53D" />
      {[14, 22, 30, 38, 44].map((x, k) => <circle key={x} cx={x} cy="45" r="2" fill={k % 2 ? '#22D3EE' : '#FF3D81'} />)}
    </svg>
  );
}

/** Anar: a flower pot throwing up a fountain of sparks. */
function Anar({ i }: { i: number }) {
  const colors = ['#FDE047', '#FFFFFF', '#FB923C', '#FF3D81'];
  return (
    <div className="relative h-11 w-11 shrink-0 sm:h-14 sm:w-14">
      {Array.from({ length: 14 }, (_, k) => {
        const spread = (k - 6.5) * 9;
        const rise = 92 + ((k * 37) % 70);
        return (
          <span key={k} className="spark absolute left-1/2 top-2 h-1.5 w-1.5 rounded-full"
            style={{ background: colors[k % colors.length], animationDelay: `${-(k * 0.13 + i * 0.2)}s`, animationDuration: `${0.9 + (k % 4) * 0.14}s`, ['--x' as string]: `${spread}px`, ['--h' as string]: `-${rise}px` }} />
        );
      })}
      <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full">
        <path d="M22 8h12l12 44H10z" fill="#D61F7A" />
        <path d="M18 24h20l2 7H16zM13 41h30l2 7H11z" fill="#FACC15" />
      </svg>
    </div>
  );
}

/** Chakri: a ground spinner. */
function Chakri() {
  return (
    <svg viewBox="-30 -30 60 60" className="h-11 w-11 shrink-0 overflow-visible sm:h-14 sm:w-14">
      <g className="chakri">
        {[0, 60, 120, 180, 240, 300].map((a, i) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0-8C10-14 18-16 24-24" fill="none" stroke={i % 2 ? '#22D3EE' : '#FDE047'} strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="26" cy="-26" r="2.6" fill={i % 2 ? '#FF3D81' : '#FFFFFF'} />
          </g>
        ))}
        <circle r="9" fill="#E8590C" /><circle r="4" fill="#FFF3B0" />
      </g>
    </svg>
  );
}

// the row along the bottom; the phone gets the first seven, anars at each end and a chakri in the middle
const ROW: ('diya' | 'anar' | 'chakri')[] = ['anar', 'diya', 'diya', 'chakri', 'diya', 'diya', 'anar', 'diya', 'diya', 'chakri', 'diya', 'anar', 'diya', 'chakri', 'diya', 'anar'];

function DiwaliNight({ front }: { front: boolean }) {
  return (
    <>
      <div aria-hidden className="diwali-night pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <Rangoli className="rangoli absolute -left-20 -top-20 h-56 w-56 opacity-60 sm:h-80 sm:w-80" />
        <Rangoli className="rangoli absolute -right-20 -top-20 h-56 w-56 opacity-60 sm:h-80 sm:w-80" />
        {[6, 17, 29, 41, 53, 66, 78, 91].map((left, i) => (
          <span key={left} className="ember absolute bottom-10 h-1 w-1 rounded-full bg-marigold" style={{ left: `${left}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${11 + (i % 3) * 3}s` }} />
        ))}
      </div>
      {/* inside the app the cards fill a phone's screen, so the sky goes over them (taps pass straight through) */}
      <div aria-hidden className={`pointer-events-none fixed inset-0 overflow-hidden ${front ? 'z-[2]' : 'z-0'}`}>
        {SKY.map((f, i) => <Firework key={f.at} {...f} i={i} />)}
      </div>
      {/* on a phone the row stands on top of the tab bar, which would otherwise hide it */}
      <div aria-hidden className={`diya-row pointer-events-none fixed inset-x-0 flex items-end justify-around px-1 pb-1 ${front ? 'bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 md:bottom-0 md:z-0 [html[data-keyboard=open]_&]:hidden' : 'bottom-0 z-0'}`}>
        {ROW.map((kind, i) => (
          <span key={i} className={i > 6 ? 'hidden md:block' : ''}>
            {kind === 'diya' ? <Diya i={i} /> : kind === 'anar' ? <Anar i={i} /> : <Chakri />}
          </span>
        ))}
      </div>
    </>
  );
}

/** The strip under the navbar for whichever festival is on. */
export function SeasonBanner() {
  return season === 'diwali' ? <DiwaliScene /> : <PapelPicado />;
}

/** The decorations behind the page for whichever festival is on. */
export function SeasonBackdrop({ front = false }: { front?: boolean }) {
  return season === 'diwali' ? <DiwaliNight front={front} /> : <SpookyNight />;
}
