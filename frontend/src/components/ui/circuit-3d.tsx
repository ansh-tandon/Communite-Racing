import { useEffect, useRef } from 'react';
import type { Outline } from '@/fixtures/tracks';

/*
 * A circuit in 3D for the Home hero, drawn the way the globe is: on a canvas, over a dot-matrix
 * ground. The track is a raised slab with lit edges, red and white kerbs on the tighter corners and a
 * chequered start line; a red light runs the lap in the racing direction. It flies in, then sways
 * gently; drag turns it (a vertical swipe still scrolls on phones). Paused off screen; still under
 * reduced motion. Drawn flat: outlines carry no elevation. Track width is drawn wider than life so it
 * reads on a phone. Sizes itself to its container, so give it one.
 */

const N = 720;          // points around the lap after resampling
const W2 = 13;          // half width, metres (drawn ~26 m wide; real tracks are 12-20 m)
const H = 16;           // slab thickness, metres (exaggerated, for depth)
const D = 2300;         // camera distance
const DOT = 34;         // ground dot spacing, metres
const TILT = (60 * Math.PI) / 180;
const SWAY = (14 * Math.PI) / 180;
const FLY_MS = 1900;
const LAP_MS = 18000;

type V2 = [number, number];

/** Metres on a local plane, smoothed (Catmull-Rom) and resampled evenly along the lap. */
function buildTrack(outline: Outline) {
  const lat0 = outline.reduce((a, p) => a + p[1], 0) / outline.length;
  const lon0 = outline.reduce((a, p) => a + p[0], 0) / outline.length;
  const kx = Math.cos((lat0 * Math.PI) / 180) * 111320, ky = 110540;
  const raw: V2[] = outline.map(([lo, la]) => [(lo - lon0) * kx, (la - lat0) * ky]);
  const cr = (p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 => {
    const t2 = t * t, t3 = t2 * t;
    const f = (k: 0 | 1) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
    return [f(0), f(1)];
  };
  const g = (j: number) => raw[(j + raw.length) % raw.length];
  const dense: V2[] = [];
  for (let i = 0; i < raw.length; i++) for (let s = 0; s < 8; s++) dense.push(cr(g(i - 1), g(i), g(i + 1), g(i + 2), s / 8));
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const step = cum[dense.length] / N;
  const P: V2[] = [];
  for (let i = 0, j = 0; i < N; i++) {
    const d = i * step;
    while (cum[j + 1] < d) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length], t = (d - cum[j]) / (cum[j + 1] - cum[j]);
    P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  const at = (i: number) => P[((i % N) + N) % N];
  const T = P.map((_, i) => { const a = at(i - 1), b = at(i + 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as V2; });
  const head = (i: number) => { const t = T[((i % N) + N) % N]; return Math.atan2(t[1], t[0]); };
  const wrap = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));
  const turn = P.map((_, i) => wrap(head(i + 3) - head(i - 3)) / (6 * step)); // rad per metre, + = left
  const L = P.map((p, i) => [p[0] - T[i][1] * W2, p[1] + T[i][0] * W2] as V2);
  const R = P.map((p, i) => [p[0] + T[i][1] * W2, p[1] - T[i][0] * W2] as V2);

  // Turn 1: the first place after the start where the line turns hard (over 70° within 120 m)
  let t1 = -1;
  const span = Math.round(120 / step);
  for (let i = 0; i < 1000 / step && t1 < 0; i++) {
    if (Math.abs(wrap(head(i + span) - head(i))) > (70 * Math.PI) / 180) {
      let best = i, bk = 0;
      for (let k = i; k < i + span; k++) if (Math.abs(turn[k]) > bk) { bk = Math.abs(turn[k]); best = k; }
      t1 = best;
    }
  }

  // ground dots around the circuit (the globe's dotted land, laid flat)
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const dots: [number, number, number][] = [];
  for (let x = Math.min(...xs) - 480; x <= Math.max(...xs) + 480; x += DOT) {
    for (let y = Math.min(...ys) - 480; y <= Math.max(...ys) + 480; y += DOT) {
      let near = Infinity;
      for (let i = 0; i < N; i += 6) { const d = Math.hypot(P[i][0] - x, P[i][1] - y); if (d < near) near = d; }
      if (near > W2 + 10 && near < 380) dots.push([x, y, near]);
    }
  }
  return { P, L, R, turn, t1, dots, at };
}

export default function Circuit3D({ outline, label = 'Circuit', className = '' }: { outline: Outline; label?: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { P, L, R, turn, t1, dots, at } = buildTrack(outline);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const BASE_YAW = (-8 * Math.PI) / 180;
    let yaw = BASE_YAW + (reduce ? 0 : 0.9), tilt = reduce ? TILT : (30 * Math.PI) / 180, zoom = reduce ? 1 : 0.82;
    let w = 0, h = 0, fit = 1, cxs = 0, cys = 0, lapU = 0.06;

    const view = (x: number, y: number, z: number): [number, number, number] => {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const xr = x * c - y * s, yr = x * s + y * c;
      const depth = D + yr * Math.sin(tilt) - z * Math.cos(tilt);
      return [xr / depth, (yr * Math.cos(tilt) + z * Math.sin(tilt)) / depth, depth];
    };
    const proj = (x: number, y: number, z = 0): [number, number, number] => {
      const [vx, vy, d] = view(x, y, z);
      return [w / 2 + (vx - cxs) * fit * zoom, h / 2 - (vy - cys) * fit * zoom, d];
    };

    // fit once over the whole sway, so the framing never jitters
    const refit = () => {
      const keep: [number, number] = [yaw, tilt];
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      tilt = TILT;
      for (const k of [-1, -0.5, 0, 0.5, 1]) {
        yaw = BASE_YAW + k * SWAY;
        for (let i = 0; i < N; i += 4) for (const q of [L[i], R[i]]) {
          const v = view(q[0], q[1], H);
          a = Math.min(a, v[0]); b = Math.max(b, v[0]); c = Math.min(c, v[1]); d = Math.max(d, v[1]);
        }
      }
      [yaw, tilt] = keep;
      cxs = (a + b) / 2; cys = (c + d) / 2;
      fit = Math.min((w * 0.95) / (b - a), (h * 0.8) / (d - c));
    };

    const chip = (x: number, y: number, text: string, red: boolean) => {
      ctx.font = '600 12px "Titillium Web", system-ui, sans-serif';
      const pw = ctx.measureText(text).width + 14, ph = 22;
      const left = Math.min(Math.max(6, x - pw / 2), w - pw - 6), top = y - ph - 14;
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, top + ph);
      ctx.strokeStyle = 'rgba(245,245,245,.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(11,13,16,.92)'; ctx.strokeStyle = red ? 'rgba(225,6,0,.6)' : 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.rect(left, top, pw, ph); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#F5F5F5'; ctx.textBaseline = 'middle'; ctx.fillText(text, left + 7, top + ph / 2 + 0.5);
    };

    const draw = () => {
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      // a faint red pool of light, ending inside the canvas so it never shows an edge
      const glow = ctx.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, Math.min(w, h) * 0.5);
      glow.addColorStop(0, 'rgba(225,6,0,0.08)'); glow.addColorStop(0.6, 'rgba(225,6,0,0.025)'); glow.addColorStop(1, 'rgba(225,6,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

      // ground dots, fading away from the track and into the distance
      for (const [x, y, near] of dots) {
        const [sx, sy, d] = proj(x, y, 0);
        if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue;
        const fade = Math.max(0, 1 - near / 380) ** 1.4 * Math.min(1, Math.max(0.15, 1.25 - (d - D) / 2600));
        if (fade < 0.03) continue;
        ctx.fillStyle = `rgba(200,206,214,${(0.07 + 0.33 * fade).toFixed(3)})`;
        const r = Math.min(2.2, Math.max(0.9, (1.7 * D) / d));
        ctx.beginPath(); ctx.arc(sx, sy, r / 2, 0, Math.PI * 2); ctx.fill();
      }

      const top = (q: V2) => proj(q[0], q[1], H), bottom = (q: V2) => proj(q[0], q[1], 0);

      // the slab's shadow on the ground
      ctx.save();
      ctx.filter = 'blur(6px)';
      ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 9; ctx.lineJoin = 'round';
      ctx.beginPath(); P.forEach((q, i) => { const [x, y] = proj(q[0] + 10, q[1] - 14, 0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
      ctx.restore();

      // the slab's sides: near-facing walls only, far ones first
      const walls: [number, number[], number[], number[], number[]][] = [];
      for (let i = 0; i < N; i++) for (const side of [L, R]) {
        const a = side[i], b = side[(i + 1) % N];
        const ta = top(a), tb = top(b), ba = bottom(a), bb = bottom(b);
        if (ba[1] - ta[1] < 0.3) continue;
        walls.push([(ta[2] + tb[2]) / 2, ta, tb, bb, ba]);
      }
      walls.sort((p, q) => q[0] - p[0]);
      ctx.fillStyle = '#07080a';
      for (const [, a, b, c, d] of walls) {
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
      }

      // asphalt
      ctx.fillStyle = '#1a1d22';
      for (let i = 0; i < N; i++) {
        const a = top(L[i]), b = top(L[(i + 1) % N]), c = top(R[(i + 1) % N]), d = top(R[i]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
      }

      // lit edges: the white track limits, with a soft glow
      const edge = (side: V2[]) => { ctx.beginPath(); side.forEach((q, i) => { const [x, y] = top(q); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); };
      ctx.save();
      ctx.shadowColor = 'rgba(235,240,248,.55)'; ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(235,240,248,.82)'; ctx.lineWidth = 1.25;
      edge(L); edge(R);
      ctx.restore();

      // kerbs: red and white on the inside of the tighter corners
      for (let i = 0; i < N; i++) {
        if (Math.abs(turn[i]) < 1 / 70) continue;
        const side = turn[i] > 0 ? L : R;
        const a = top(side[i]), b = top(side[(i + 1) % N]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        ctx.strokeStyle = (i >> 1) % 2 ? '#F5F5F5' : '#E10600'; ctx.lineWidth = 2.6; ctx.stroke();
      }

      // start / finish: a chequered band across the track
      const across = (t: number, i: number) => { const l = L[i], r = R[i]; return top([l[0] + (r[0] - l[0]) * t, l[1] + (r[1] - l[1]) * t]); };
      for (let j = 0; j < 8; j++) for (let row = 0; row < 2; row++) {
        const a = across(j / 8, row), b = across((j + 1) / 8, row), c = across((j + 1) / 8, row + 1), d = across(j / 8, row + 1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
        ctx.fillStyle = (j + row) % 2 ? '#F5F5F5' : '#0B0D10'; ctx.fill();
      }

      // the lap light: a red comet running the racing line
      const headI = Math.floor(lapU * N), trail = 70;
      ctx.save();
      ctx.lineCap = 'round';
      for (let k = trail; k > 0; k--) {
        const a = at(headI - k), b = at(headI - k + 1), pa = proj(a[0], a[1], H + 0.5), pb = proj(b[0], b[1], H + 0.5);
        const f = 1 - k / trail;
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
        ctx.strokeStyle = `rgba(225,6,0,${(f * f * 0.95).toFixed(3)})`; ctx.lineWidth = 1 + f * 3.2; ctx.stroke();
      }
      const hp = at(headI), [hx, hy] = proj(hp[0], hp[1], H + 0.5);
      ctx.shadowColor = 'rgba(225,6,0,.9)'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(hx, hy, 4.2, 0, Math.PI * 2); ctx.fillStyle = '#FF2A1F'; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(hx, hy, 1.8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();

      const s0 = top(P[0]); chip(s0[0], s0[1], 'Start / Finish', true);
      if (t1 >= 0) { const q = top(P[t1]); chip(q[0], q[1], 'Turn 1', false); }
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      refit(); draw();
    };

    // fly in, then sway; drag to turn, and it drifts back to the hero angle after a moment
    let raf = 0, last = 0, start = 0, sway0 = 0, back = 0, onScreen = true, dragging = false;
    let mode: 'fly' | 'sway' | 'drag' | 'still' = reduce ? 'still' : 'fly';
    const from = { yaw, tilt, zoom };
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const frame = (now: number) => {
      raf = 0;
      if (!start) start = now;
      const dt = last ? now - last : 16; last = now;
      if (mode === 'fly') {
        const e = ease(Math.min(1, (now - start) / FLY_MS));
        yaw = from.yaw + (BASE_YAW - from.yaw) * e; tilt = from.tilt + (TILT - from.tilt) * e; zoom = from.zoom + (1 - from.zoom) * e;
        if (e >= 1) { mode = 'sway'; sway0 = now; }
      } else if (mode === 'sway' && !dragging) {
        yaw = BASE_YAW + Math.sin(((now - sway0) / 20000) * Math.PI * 2) * SWAY;
      }
      lapU = (lapU + dt / LAP_MS) % 1;
      draw();
      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const go = () => { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(frame); } };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; mode = 'drag'; window.clearTimeout(back);
      canvas.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, y0 = yaw, t0 = tilt;
      const move = (m: PointerEvent) => {
        yaw = y0 + (m.clientX - sx) * 0.006;
        tilt = Math.max((30 * Math.PI) / 180, Math.min((72 * Math.PI) / 180, t0 - (m.clientY - sy) * 0.004));
        if (reduce) draw();
      };
      const up = () => {
        dragging = false;
        canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
        back = window.setTimeout(() => {
          if (reduce) { yaw = BASE_YAW; tilt = TILT; draw(); return; }
          from.yaw = yaw; from.tilt = tilt; from.zoom = zoom; start = 0; mode = 'fly'; go();
        }, 2500);
      };
      canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    };
    canvas.addEventListener('pointerdown', onDown);

    const sizeObs = new ResizeObserver(resize);
    sizeObs.observe(canvas);
    const viewObs = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) go(); });
    viewObs.observe(canvas);
    const onVisible = () => { if (!document.hidden) go(); };
    document.addEventListener('visibilitychange', onVisible);
    resize();
    void document.fonts?.ready.then(draw);
    go();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(back);
      sizeObs.disconnect(); viewObs.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('pointerdown', onDown);
    };
  }, [outline]);

  return (
    <div role="img" aria-label={label} className={`relative select-none ${className}`}>
      {/* pan-y: a vertical swipe still scrolls the page on phones; sideways turns the circuit */}
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing" />
    </div>
  );
}
