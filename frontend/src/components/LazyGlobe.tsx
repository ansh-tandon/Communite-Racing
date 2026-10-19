import { lazy, Suspense, type ComponentProps } from 'react';
import type { RaceSummary } from '../api/types';
import { circuitPlace } from '../fixtures/circuits';
import type { GlobeMarker, GlobePin } from './ui/wireframe-dotted-globe';

// d3 and the globe load only on screens that show one.
const RotatingEarth = lazy(() => import('@/components/ui/wireframe-dotted-globe'));
const Circuit3D = lazy(() => import('@/components/ui/circuit-3d'));

export function LazyGlobe(props: ComponentProps<typeof RotatingEarth>) {
  return (
    <Suspense fallback={<div className={`rounded-full bg-surface ${props.className ?? ''}`} />}>
      <RotatingEarth {...props} />
    </Suspense>
  );
}

/** The 3D circuit (Home hero only), loaded the same lazy way. */
export function LazyCircuit(props: ComponentProps<typeof Circuit3D>) {
  return (
    <Suspense fallback={<div className={props.className} />}>
      <Circuit3D {...props} />
    </Suspense>
  );
}

/** The race's circuit as a labelled pin, or null when we can't place it. */
export function racePin(race: { circuit: string; name: string; country: string }): GlobePin | null {
  const p = circuitPlace(race);
  return p && { lat: p.lat, lng: p.lng, label: p.city };
}

/** The season in round order; races already scored are dimmed. */
export function seasonMarkers(races: RaceSummary[]): GlobeMarker[] {
  return [...races]
    .sort((a, b) => a.round - b.round)
    .flatMap((r) => {
      const p = circuitPlace(r);
      return p ? [{ lat: p.lat, lng: p.lng, done: r.phase === 'results' }] : [];
    });
}
