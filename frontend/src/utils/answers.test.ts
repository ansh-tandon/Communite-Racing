// Same cases as backend/tests/test_scoring.py, so the client mirror can't drift from the server.
import type { Question } from '../api/types';
import { computeScores, isComplete, scoreAnswer, validateValue } from './answers';

const q = (id: number, type: Question['type'], weight: number, config: Question['config'] = {}, options: string[] = []): Question =>
  ({ id, sequence: id, prompt: '', type, weight, config, options });
const DRIVERS = ['VER', 'NOR', 'LEC', 'HAM', 'PIA', 'ALO', 'RUS', 'SAI', 'GAS', 'OCO', 'BOT'];
const WIN = q(1, 'single', 10, {}, DRIVERS), PODIUM = q(2, 'ranked', 15, { pick: 3 }, DRIVERS);
const TOP10 = q(3, 'multi', 9, { pick: 3 }, DRIVERS), SC = q(4, 'yes_no', 5), PITS = q(5, 'number', 6, { tolerance: 1 });
const KEY = { 1: 'VER', 2: ['VER', 'NOR', 'LEC'], 3: ['VER', 'NOR', 'PIA'], 4: true, 5: 4 };

describe('scoreAnswer', () => {
  it('scores exact types', () => {
    expect(scoreAnswer(WIN, 'VER', 'VER')).toBe(10);
    expect(scoreAnswer(WIN, 'NOR', 'VER')).toBe(0);
    expect(scoreAnswer(SC, true, true)).toBe(5);
  });
  it('applies number tolerance', () => {
    expect([2, 3, 4, 5, 6].map((g) => scoreAnswer(PITS, g, 4))).toEqual([0, 6, 6, 6, 0]);
  });
  it('scores ranked by slot', () => {
    expect(scoreAnswer(PODIUM, ['VER', 'NOR', 'LEC'], KEY[2])).toBe(15);
    expect(scoreAnswer(PODIUM, ['VER', 'LEC', 'NOR'], KEY[2])).toBe(5);
    expect(scoreAnswer(PODIUM, ['VER'], KEY[2])).toBe(5);
  });
  it('treats "pick 3 in the top 10" as full marks when all three are inside', () => {
    const big = ['VER', 'NOR', 'LEC', 'HAM', 'PIA', 'ALO', 'RUS', 'SAI', 'GAS', 'OCO'];
    expect(scoreAnswer(TOP10, ['VER', 'HAM', 'OCO'], big)).toBe(9);
    expect(scoreAnswer(TOP10, ['VER', 'HAM', 'BOT'], big)).toBe(6);
    expect(scoreAnswer(q(3, 'multi', 9, { pick: 3, scoring: 'all' }), ['VER', 'HAM', 'BOT'], big)).toBe(0);
  });
  it('gives nothing for no answer', () => expect(scoreAnswer(WIN, undefined, 'VER')).toBe(0));
});

describe('computeScores', () => {
  it('weights, ranks and shares ties', () => {
    const entries = new Map<number, Record<number, string | string[] | number | boolean>>([
      [11, { 1: 'VER', 2: ['VER', 'NOR', 'LEC'], 3: ['VER', 'NOR', 'PIA'], 4: true, 5: 4 }],
      [12, { 1: 'VER', 2: ['VER', 'LEC', 'NOR'], 4: true }],
      [13, { 1: 'VER', 2: ['VER', 'LEC', 'NOR'], 4: true }],
      [14, {}],
    ]);
    const r = computeScores([WIN, PODIUM, TOP10, SC, PITS], KEY, entries);
    expect(r.map((x) => [x.user_id, x.points, x.rank])).toEqual([[11, 45, 1], [12, 20, 2], [13, 20, 2], [14, 0, 4]]);
    expect(r[0].correct_count).toBe(5);
  });
});

describe('validateValue', () => {
  it('rejects bad shapes', () => {
    expect(validateValue(TOP10, ['VER', 'VER'])).toMatch(/once/);
    expect(validateValue(TOP10, ['VER', 'NOR', 'LEC', 'HAM'])).toMatch(/at most 3/);
    expect(validateValue(TOP10, ['XXX'])).toMatch(/options/);
    expect(validateValue(PITS, 1.5)).toMatch(/whole/);
    expect(validateValue(SC, 'yes')).toMatch(/yes or no/);
    expect(validateValue(PODIUM, ['VER'], true)).toMatch(/exactly 3/);
  });
  it('lets the result list more than players pick', () => {
    expect(validateValue(TOP10, ['VER', 'NOR', 'LEC', 'HAM'], true)).toBeNull();
  });
  it('counts partial picks as not complete', () => {
    expect(isComplete(PODIUM, ['VER'])).toBe(false);
    expect(isComplete(PODIUM, ['VER', 'NOR', 'LEC'])).toBe(true);
  });
});
