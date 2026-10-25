import { describe, expect, it } from 'vitest';
import type { RaceSummary } from '../api/types';
import { featuredRace } from './format';

const race = (id: number, round: number, phase: RaceSummary['phase'], opens: string, closes: string) =>
  ({ id, round, phase, quiz_opens_at: opens, quiz_closes_at: closes } as RaceSummary);

// Race night, 25-26 Oct 2026 (UTC): FP1 test quiz (round 40) locked two days ago and never scored,
// the US GP (round 18) opens 18:10 and locks at lights out 20:00, Mexico (round 19) opens at 20:00.
const fp1 = (phase: RaceSummary['phase'] = 'closed') => race(10, 40, phase, '2026-10-23T17:36:00Z', '2026-10-23T18:10:00Z');
const usgp = (phase: RaceSummary['phase']) => race(4, 18, phase, '2026-10-25T18:10:00Z', '2026-10-25T20:00:00Z');
const mexico = (phase: RaceSummary['phase']) => race(5, 19, phase, '2026-10-25T20:00:00Z', '2026-11-01T20:00:00Z');
const at = (iso: string) => new Date(iso);

describe('featuredRace', () => {
  it('shows the race about to open, not an old locked practice quiz with a higher round number', () => {
    expect(featuredRace([fp1(), usgp('upcoming'), mexico('upcoming')], at('2026-10-25T15:45:00Z'))?.id).toBe(4);
  });
  it('shows the open quiz once it opens', () => {
    expect(featuredRace([fp1(), usgp('open'), mexico('upcoming')], at('2026-10-25T18:30:00Z'))?.id).toBe(4);
  });
  it('keeps the race in focus while it is live, even though the next quiz has opened', () => {
    expect(featuredRace([fp1(), usgp('closed'), mexico('open')], at('2026-10-25T21:00:00Z'))?.id).toBe(4);
  });
  it('moves on to the next quiz once results are published', () => {
    expect(featuredRace([fp1('results'), usgp('results'), mexico('open')], at('2026-10-26T03:00:00Z'))?.id).toBe(5);
  });
  it('falls back to the latest results when nothing else is on', () => {
    expect(featuredRace([fp1('results'), usgp('results')], at('2026-12-20T00:00:00Z'))?.id).toBe(4);
  });
});
