import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { easeCubicInOut, geoGraticule10, geoOrthographic, geoPath, timer, type Timer } from 'd3';
import type { FeatureCollection, Polygon } from 'geojson';

/**
 * Dotted wireframe globe (canvas + d3-geo). With a `target` it flies to that spot and
 * pins it, e.g. the circuit of the race being predicted; without one it turns slowly.
 * Drag to rotate (mouse or touch). Sizes itself to its container, so give it one.
 */

export interface GlobePin {
  lat: number;
  lng: number;
  label?: string;
}

/** A circuit on the calendar; `done` races are dimmed. */
export interface GlobeMarker {
  lat: number;
  lng: number;
  done?: boolean;
}

interface RotatingEarthProps {
  target?: GlobePin | null;
  /** Other circuits to plot, in calendar order. */
  markers?: GlobeMarker[];
  /** Join the markers in order; the leg into the target is drawn in red. */
  route?: boolean;
  /** Spin in from the side before settling on the target: the "pinpoint" moment. */
  flyIn?: boolean;
  /** Once on the target, keep turning gently either side of it so the pin never leaves view. */
  sway?: boolean;
  className?: string;
}

const LAND_URL = '/geo/land-110m.json'; // Natural Earth 1:110m land, public domain, self-hosted
const RAD = Math.PI / 180;
const COLOURS = {
  ocean: '#121212',
  grid: 'rgba(255,255,255,0.06)',
  coast: 'rgba(255,255,255,0.28)',
  dot: '#7A7A7A',
  rim: 'rgba(255,255,255,0.22)',
  route: 'rgba(255,255,255,0.22)',
  leg: 'rgba(225,6,0,0.9)',
  marker: '#FFFFFF',
  markerDone: '#5E5E5E',
};

type Land = FeatureCollection<Polygon>;

// Land and its dots are the same for every globe on the page: load and compute once.
let landPromise: Promise<{ land: Land; dots: Float32Array }> | null = null;
function loadLand() {
  landPromise ??= fetch(LAND_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`land map: ${r.status}`);
      return r.json() as Promise<Land>;
    })
    .then((land) => ({ land, dots: makeDots(land) }))
    .catch((e) => {
      landPromise = null; // let the next globe try again
      throw e;
    });
  return landPromise;
}

const inRing = (x: number, y: number, ring: number[][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Dots on land, about 1.3° apart on the sphere, as [lng, lat, x, y, z] runs. */
function makeDots(land: Land) {
  const out: number[] = [];
  const step = 1.3;
  for (const f of land.features) {
    const rings = f.geometry.coordinates;
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    for (const [x, y] of rings[0]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    for (let lat = Math.ceil(minY / step) * step; lat <= maxY; lat += step) {
      // wider spacing towards the poles keeps the dots even on the sphere
      const lngStep = step / Math.max(Math.cos(lat * RAD), 0.2);
      for (let lng = Math.ceil(minX / lngStep) * lngStep; lng <= maxX; lng += lngStep) {
        if (!inRing(lng, lat, rings[0]) || rings.slice(1).some((h) => inRing(lng, lat, h))) continue;
        const c = Math.cos(lat * RAD);
        out.push(lng, lat, c * Math.cos(lng * RAD), c * Math.sin(lng * RAD), Math.sin(lat * RAD));
      }
    }
  }
  return new Float32Array(out);
}

/** How directly a point faces the viewer (1 = centre of the disc, ≤ 0 = far side). */
function facing(lng: number, lat: number, rot: [number, number]) {
  const l = -rot[0] * RAD, p = -rot[1] * RAD, a = lng * RAD, b = lat * RAD;
  return Math.cos(p) * Math.cos(b) * Math.cos(a - l) + Math.sin(p) * Math.sin(b);
}

export default function RotatingEarth({ target = null, markers, route = false, flyIn = false, sway = false, className = '' }: RotatingEarthProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const lat = target?.lat;
  const lng = target?.lng;
  // Callers build a new array each render; only a real change restarts the globe.
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const markerKey = markers?.map((m) => `${m.lat},${m.lng},${m.done ? 1 : 0}`).join('|') ?? '';

  // The pin's label types itself out, one character at a time, once the globe arrives.
  const label = target?.label ?? '';
  const labelRef = useRef<HTMLSpanElement>(null);
  const placeLabelRef = useRef<() => void>();
  const [arrived, setArrived] = useState(false);
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (!arrived || !label) { setTyped(0); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setTyped(label.length); return; }
    let i = 0;
    setTyped(0);
    const t = window.setInterval(() => { i += 1; setTyped(i); if (i >= label.length) window.clearInterval(t); }, 45);
    return () => window.clearInterval(t);
  }, [arrived, label]);
  useLayoutEffect(() => { placeLabelRef.current?.(); }, [arrived, label]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wrap || !canvas || !ctx) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pinned = lat !== undefined && lng !== undefined;
    const home: [number, number] = pinned ? [-lng, -lat] : [-20, -18];
    const swoop = pinned && flyIn && !reduce;
    let rot: [number, number] = swoop ? [home[0] + 140, home[1] * 0.3] : [home[0], home[1]];
    let zoom = swoop ? 0.86 : 1;
    let w = 0, h = 0, r = 0;
    let land: Land | null = null;
    let dots: Float32Array | null = null;
    let anim: Timer | null = null;
    let drift: Timer | null = null;
    let backHome: number | undefined;
    let swaying: Timer | null = null;
    let lastPin: [number, number] | null = null;
    setArrived(false);

    // Centre the label above the pin, but keep it inside the globe's box (phones are narrow).
    const placeLabel = () => {
      const el = labelRef.current;
      if (!el || !lastPin || !w) return;
      const lw = el.offsetWidth;
      const left = Math.min(Math.max(4, lastPin[0] - lw / 2), Math.max(4, w - lw - 4));
      el.style.transform = `translateX(${left - lastPin[0]}px)`;
    };
    placeLabelRef.current = placeLabel;
    let onScreen = true;
    let dragging = false;

    const projection = geoOrthographic().clipAngle(90).precision(0.6);
    const path = geoPath(projection, ctx);
    const grid = geoGraticule10();

    const draw = () => {
      if (!w) return;
      const R = r * zoom;
      projection.translate([w / 2, h / 2]).scale(R).rotate(rot);
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, 0, 2 * Math.PI);
      ctx.fillStyle = COLOURS.ocean;
      ctx.fill();
      ctx.beginPath();
      path(grid);
      ctx.strokeStyle = COLOURS.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (land && dots) {
        ctx.beginPath();
        path(land);
        ctx.strokeStyle = COLOURS.coast;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // centre of the view as a unit vector; dots on the far side are skipped
        const l = -rot[0] * RAD, p = -rot[1] * RAD;
        const cx = Math.cos(p) * Math.cos(l), cy = Math.cos(p) * Math.sin(l), cz = Math.sin(p);
        const dr = Math.max(0.7, R / 200);
        ctx.beginPath();
        for (let i = 0; i < dots.length; i += 5) {
          if (dots[i + 2] * cx + dots[i + 3] * cy + dots[i + 4] * cz <= 0.02) continue;
          const pt = projection([dots[i], dots[i + 1]]);
          if (!pt) continue;
          ctx.moveTo(pt[0] + dr, pt[1]);
          ctx.arc(pt[0], pt[1], dr, 0, 2 * Math.PI);
        }
        ctx.fillStyle = COLOURS.dot;
        ctx.fill();
      }
      const ms = markersRef.current;
      if (ms?.length) {
        if (route && ms.length > 1) {
          ctx.beginPath();
          path({ type: 'LineString', coordinates: ms.map((m) => [m.lng, m.lat]) });
          ctx.strokeStyle = COLOURS.route;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          const i = pinned ? ms.findIndex((m) => m.lat === lat && m.lng === lng) : -1;
          if (i > 0) {
            ctx.beginPath();
            path({ type: 'LineString', coordinates: [[ms[i - 1].lng, ms[i - 1].lat], [ms[i].lng, ms[i].lat]] });
            ctx.strokeStyle = COLOURS.leg;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        }
        for (const m of ms) {
          if (facing(m.lng, m.lat, rot) <= 0.02) continue;
          const pt = projection([m.lng, m.lat]);
          if (!pt) continue;
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], m.done ? Math.max(2, R / 150) : Math.max(2.6, R / 110), 0, 2 * Math.PI);
          ctx.fillStyle = m.done ? COLOURS.markerDone : COLOURS.marker;
          ctx.fill();
        }
      }
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, 0, 2 * Math.PI);
      ctx.strokeStyle = COLOURS.rim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const pin = pinRef.current;
      if (pin && pinned) {
        const pt = projection([lng, lat]);
        const seen = facing(lng, lat, rot) > 0.08;
        pin.style.opacity = seen && pt ? '1' : '0';
        if (pt) {
          pin.style.transform = `translate(${pt[0]}px, ${pt[1]}px)`;
          lastPin = [pt[0], pt[1]];
          placeLabel();
        }
      }
    };

    const resize = () => {
      const box = wrap.getBoundingClientRect();
      w = Math.max(1, box.width);
      h = Math.max(1, box.height);
      r = (Math.min(w, h) / 2) * 0.94;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const animateTo = (to: [number, number], toZoom: number, ms: number, done?: () => void) => {
      anim?.stop();
      const from: [number, number] = [rot[0], rot[1]];
      const fromZoom = zoom;
      const dl = ((((to[0] - from[0]) % 360) + 540) % 360) - 180; // shortest way round
      anim = timer((t) => {
        const k = Math.min(1, t / ms);
        const e = easeCubicInOut(k);
        rot = [from[0] + dl * e, from[1] + (to[1] - from[1]) * e];
        zoom = fromZoom + (toZoom - fromZoom) * e;
        draw();
        if (k >= 1) { anim?.stop(); anim = null; done?.(); }
      });
    };

    // Pinned and swaying: about 14° either side of the target, one sweep every 20 s.
    const startSway = () => {
      if (!sway || !pinned || reduce || swaying || anim || dragging || !onScreen) return;
      let t0 = -1;
      swaying = timer((t) => {
        if (t0 < 0) t0 = t;
        rot = [home[0] + Math.sin(((t - t0) / 20000) * 2 * Math.PI) * 14, home[1]];
        draw();
      });
    };
    const stopSway = () => { swaying?.stop(); swaying = null; };

    // No target: a slow turn, paused off screen, never under reduced motion.
    const startDrift = () => {
      if (pinned || reduce || drift || !onScreen) return;
      let last = 0;
      drift = timer((t) => {
        if (!dragging) { rot = [rot[0] + (t - last) * 0.006, rot[1]]; draw(); }
        last = t;
      });
    };
    const stopDrift = () => { drift?.stop(); drift = null; };

    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      if (swoop) animateTo(home, 1, 1700, () => { setArrived(true); startSway(); });
      else { setArrived(true); startDrift(); startSway(); }
    };
    loadLand()
      .then((l) => { land = l.land; dots = l.dots; draw(); })
      .catch(() => { /* no land map: the globe and pin still work */ })
      .finally(begin);
    const slowLoad = window.setTimeout(begin, 900);

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      anim?.stop(); anim = null;
      stopSway();
      window.clearTimeout(backHome);
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY;
      const start: [number, number] = [rot[0], rot[1]];
      const perPx = 70 / Math.max(r, 60);
      const move = (m: PointerEvent) => {
        rot = [start[0] + (m.clientX - sx) * perPx, Math.max(-75, Math.min(75, start[1] - (m.clientY - sy) * perPx))];
        draw();
      };
      const up = () => {
        dragging = false;
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
        // a pinned globe drifts back to the race after a moment
        if (pinned) backHome = window.setTimeout(() => animateTo(home, 1, reduce ? 1 : 1100, startSway), 2500);
      };
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
    };
    canvas.addEventListener('pointerdown', onDown);

    const sizeObs = new ResizeObserver(resize);
    sizeObs.observe(wrap);
    const viewObs = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) { startDrift(); startSway(); } else { stopDrift(); stopSway(); }
    });
    viewObs.observe(wrap);
    resize();

    return () => {
      anim?.stop();
      stopDrift();
      stopSway();
      window.clearTimeout(backHome);
      window.clearTimeout(slowLoad);
      sizeObs.disconnect();
      viewObs.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
    };
  }, [lat, lng, flyIn, sway, route, markerKey]);

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={target ? `Globe pinned on ${target.label ?? 'the circuit'}` : 'Globe'}
      className={`relative select-none ${className}`}
    >
      {/* pan-y: a vertical swipe still scrolls the page on phones; sideways turns the globe */}
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing" />
      {target && (
        <div ref={pinRef} aria-hidden className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-200">
          {/* a soft, steady halo rather than a big ping */}
          <span className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] animate-pulse rounded-full bg-accent/25" />
          <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent ring-[1.5px] ring-white" />
          {label && arrived && (
            // The box is laid out at its full width from the start (the untyped rest is invisible),
            // so it stays put; only the typed part has a background, so no empty bar shows.
            <span ref={labelRef} className="absolute bottom-[14px] left-0 whitespace-nowrap text-[13px] font-semibold leading-none tracking-[0.01em] text-white">
              <span className="inline-block rounded-sm border border-white/10 bg-[#0B0D10]/90 px-2 py-1.5">
                {label.slice(0, typed)}
                <span className={`ml-px inline-block h-[0.9em] w-[2px] translate-y-[1px] bg-accent ${typed < label.length ? 'animate-pulse' : 'opacity-0'}`} />
              </span>
              <span className="invisible">{label.slice(typed)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
