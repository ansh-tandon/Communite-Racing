import type { LeaderRow, SeasonRow } from '../api/types';
import { rankMovement } from './leaderboard';

const row = (user_id: number, rank: number, points: number, races: number): SeasonRow => ({ user_id, rank, points, races, name: `P${user_id}`, wins: 0, podiums: 0 });
const last = (user_id: number, points: number): LeaderRow => ({ user_id, points, rank: 1, name: `P${user_id}`, correct_count: 0 });

it('counts places gained and lost in the latest round', () => {
  // before the round: 1 → 30, 2 → 25, 3 → 20.  The round: 3 scores 15, 1 scores 0, 2 scores 2.
  const rows = [row(3, 1, 35, 2), row(1, 2, 30, 2), row(2, 3, 27, 2)];
  const m = rankMovement(rows, [last(3, 15), last(1, 0), last(2, 2)]);
  expect(m.get(3)).toBe(2);
  expect(m.get(1)).toBe(-1);
  expect(m.get(2)).toBe(-1);
});

it('ranks ties the way the backend does (1, 2, 2, 4)', () => {
  // before: 1 → 20, 2 → 20, 3 → 20, 4 → 10 (ranks 1, 1, 1, 4). After: 4 scores 15 and 1 scores 1.
  const rows = [row(4, 1, 25, 2), row(1, 2, 21, 2), row(2, 3, 20, 2), row(3, 3, 20, 2)];
  const m = rankMovement(rows, [last(4, 15), last(1, 1), last(2, 0), last(3, 0)]);
  expect(m.get(4)).toBe(3);
  expect(m.get(1)).toBe(-1);
  expect(m.get(2)).toBe(-2);
  expect(m.get(3)).toBe(-2);
});

it('marks a player whose only race is the latest one as new, and leaves non-players unchanged', () => {
  const rows = [row(1, 1, 30, 2), row(2, 2, 12, 1), row(3, 3, 5, 1)];
  const m = rankMovement(rows, [last(1, 10), last(2, 12)]);
  expect(m.get(2)).toBe('new');
  expect(m.get(1)).toBe(0); // 20 before, still first
  expect(m.get(3)).toBe(-1); // 5 before (2nd of two), now 3rd
});
