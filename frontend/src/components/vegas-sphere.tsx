import { useEffect, useId, useRef } from 'react';

// Las Vegas GP (sign-in page): a giant LED sphere with a face that watches the race cars go by underneath, and
// between cars follows the player's cursor or finger. Our own face and car; no real artwork, logos or teams.

const SPHERE = { cx: 100, cy: 92, r: 80 };
const EYES = [{ x: 70, y: 108 }, { x: 130, y: 108 }];
const ROAD_Y = 186;
const LAP_MS = 6500;  // a car comes past this often
const PASS_MS = 2300; // and takes this long to cross
const LOOK_MS = 2500; // after the cursor moves, the eyes follow it this long

// The band across the forehead, and its length in viewBox units so the words loop seamlessly.
const BAND = 'M14 56Q100 32 186 56';
const BAND_LEN = 174.2;
const BAND_TEXT = 'ALL IN ON THE RACE · LAS VEGAS GP · ';

/** A race car in side view, nose to the right, centred on its own origin, with a light trail behind it. */
function Car({ trail }: { trail: string }) {
  return (
    <>
      <rect x="-66" y="-1.2" width="48" height="2.4" fill={`url(#${trail})`} />
      <path d="M-18 1L-16-3-6-4-2-7H4L7-4 15-3 19 0 18 2Z" fill="#0B0D10" stroke="#FF2E88" strokeWidth=".6" strokeLinejoin="round" />
      <rect x="-20" y="-8.5" width="3.4" height="5.5" rx=".6" fill="#0B0D10" stroke="#FF2E88" strokeWidth=".5" />
      <rect x="15" y="1" width="6" height="1.6" rx=".5" fill="#0B0D10" stroke="#FF2E88" strokeWidth=".5" />
      <circle cx="1" cy="-6.2" r="1.7" fill="#FFD166" />
      <circle cx="-11" cy="2.6" r="3.5" fill="#15121F" stroke="#5B5675" strokeWidth=".7" />
      <circle cx="11" cy="2.6" r="3.5" fill="#15121F" stroke="#5B5675" strokeWidth=".7" />
    </>
  );
}

export function StaringSphere({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const pupils = useRef<(SVGCircleElement | null)[]>([]);
  const car = useRef<SVGGElement>(null);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || still) return;
    const start = performance.now();
    let raf = 0;
    let pointer = { x: 100, y: ROAD_Y, at: -Infinity };
    const eyes = EYES.map((e) => ({ x: e.x, y: e.y }));

    const onPoint = (ev: PointerEvent) => {
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      pointer = { x: p.x, y: p.y, at: performance.now() };
    };
    window.addEventListener('pointermove', onPoint, { passive: true });
    window.addEventListener('pointerdown', onPoint, { passive: true });

    const tick = (now: number) => {
      const t = (now - start) % LAP_MS;
      const passing = t < PASS_MS;
      const carX = passing ? -30 + (t / PASS_MS) * 270 : -80;
      car.current?.setAttribute('transform', `translate(${carX.toFixed(1)} ${ROAD_Y})`);

      // what the eyes look at: the car while it passes, else the cursor, else the road where the next car comes from
      let tx: number, ty: number;
      if (passing) [tx, ty] = [carX, ROAD_Y];
      else if (now - pointer.at < LOOK_MS) [tx, ty] = [pointer.x, pointer.y];
      else if (t > LAP_MS - 800) [tx, ty] = [-20, ROAD_Y];
      else [tx, ty] = [100 + Math.sin(now / 1700) * 35, 160];

      EYES.forEach((e, i) => {
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 50);
        eyes[i].x += (e.x + (dx / d) * 9 * k - eyes[i].x) * 0.2;
        eyes[i].y += (e.y + (dy / d) * 8 * k - eyes[i].y) * 0.2;
        pupils.current[i]?.setAttribute('cx', eyes[i].x.toFixed(2));
        pupils.current[i]?.setAttribute('cy', eyes[i].y.toFixed(2));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPoint);
      window.removeEventListener('pointerdown', onPoint);
    };
  }, [still]);

  const { cx, cy, r } = SPHERE;
  return (
    <svg ref={svgRef} viewBox="0 0 200 200" role="img" aria-label="A giant sphere with a face, watching the race cars go by" className={`stare ${className}`}>
      <defs>
        <radialGradient id={`${id}face`} cx="40%" cy="38%" r="70%">
          <stop offset="0" stopColor="#FFF07A" /><stop offset=".55" stopColor="#FFD21F" /><stop offset=".9" stopColor="#E3A300" /><stop offset="1" stopColor="#B97C00" />
        </radialGradient>
        <linearGradient id={`${id}cap`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0EA5E9" /><stop offset="1" stopColor="#22D3EE" /></linearGradient>
        <linearGradient id={`${id}trail`}><stop offset="0" stopColor="#FF2E88" stopOpacity="0" /><stop offset="1" stopColor="#FF2E88" stopOpacity=".9" /></linearGradient>
        <pattern id={`${id}led`} width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".55" fill="#000" fillOpacity=".16" /></pattern>
        <clipPath id={`${id}ball`}><circle cx={cx} cy={cy} r={r} /></clipPath>
        {EYES.map((e, i) => <clipPath key={i} id={`${id}eye${i}`}><ellipse cx={e.x} cy={e.y} rx="19" ry="21" /></clipPath>)}
        <path id={`${id}band`} d={BAND} />
      </defs>

      {/* the road, and the car on it (off to the left until it comes past) */}
      <path d={`M0 ${ROAD_Y + 5}H200`} stroke="#3B3363" strokeWidth="1" />
      <path d={`M0 ${ROAD_Y + 10}H200`} stroke="#22D3EE" strokeOpacity=".35" strokeWidth=".6" strokeDasharray="6 5" />
      <g ref={car} transform={`translate(-80 ${ROAD_Y})`}><Car trail={`${id}trail`} /></g>

      <g clipPath={`url(#${id}ball)`}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}face)`} />
        <path d="M0 0H200V48Q100 26 0 48Z" fill={`url(#${id}cap)`} />
        <path d={BAND} fill="none" stroke="#5CE1FF" strokeWidth="17" />
        <path d={BAND} fill="none" stroke="#FBFBFF" strokeWidth="14.6" />
        <text className="font-display" fontSize="9" fontWeight="900" fill="#1B1464" dy="3.2">
          <textPath href={`#${id}band`} textLength={BAND_LEN * 2} lengthAdjust="spacing">
            {BAND_TEXT + BAND_TEXT}
            {!still && <animate attributeName="startOffset" from="0" to={-BAND_LEN} dur="18s" repeatCount="indefinite" />}
          </textPath>
        </text>

        {/* heavy, unimpressed brows; eyes that blink now and then */}
        <rect x="48" y="76" width="44" height="7" rx="3.5" fill="#1A1206" transform="rotate(3 70 79)" />
        <rect x="108" y="76" width="44" height="7" rx="3.5" fill="#1A1206" transform="rotate(-3 130 79)" />
        {EYES.map((e, i) => (
          <g key={i} className="blink">
            <ellipse cx={e.x} cy={e.y} rx="19" ry="21" fill="#FFFFFF" />
            <g clipPath={`url(#${id}eye${i})`}>
              <circle ref={(el) => { pupils.current[i] = el; }} cx={e.x} cy={e.y + 6} r="9.5" fill="#111111" />
            </g>
          </g>
        ))}
        <path d="M90 150Q102 156 113 147" fill="none" stroke="#6B4600" strokeWidth="2.6" strokeLinecap="round" />

        {/* LED pixels, and a soft highlight on the curve */}
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}led)`} />
        <ellipse cx="72" cy="46" rx="40" ry="16" fill="#fff" fillOpacity=".1" />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#5CE1FF" strokeOpacity=".4" strokeWidth=".6" />
    </svg>
  );
}
