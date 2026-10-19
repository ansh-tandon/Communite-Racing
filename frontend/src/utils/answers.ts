// Client-side mirror of backend/app/services/questions.py and scoring.py.
// The server stays the authority: this only gives instant feedback and powers demo mode.
import type { AnswerValue, Question } from '../api/types';

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Returns an error message, or null when the value is acceptable. */
export function validateValue(q: Question, value: unknown, isKey = false): string | null {
  switch (q.type) {
    case 'single':
      return q.options.includes(value as string) ? null : 'Pick one of the options.';
    case 'yes_no':
      return typeof value === 'boolean' ? null : 'Answer yes or no.';
    case 'number': {
      if (!isInt(value)) return 'Enter a whole number.';
      const { min, max } = q.config;
      if ((min !== undefined && value < min) || (max !== undefined && value > max)) return `Enter a number from ${min ?? '…'} to ${max ?? '…'}.`;
      return null;
    }
    default: {
      if (!Array.isArray(value) || value.length === 0) return 'Pick at least one option.';
      if (value.some((v) => !q.options.includes(v))) return "That isn't one of the options.";
      if (new Set(value).size !== value.length) return 'Each option can only be picked once.';
      const pick = q.config.pick ?? value.length;
      if (q.type === 'ranked' && isKey && value.length !== pick) return `The result needs exactly ${pick} in order.`;
      if (value.length > pick && !(isKey && q.type === 'multi')) return `Pick at most ${pick}.`;
      return null;
    }
  }
}

/** "Complete" for progress purposes: list questions need all their picks. */
export function isComplete(q: Question, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length === (q.config.pick ?? 1);
  return true;
}

export function scoreAnswer(q: Question, given: AnswerValue | undefined, key: AnswerValue | undefined): number {
  if (given === undefined || key === undefined) return 0;
  const w = q.weight;
  if (q.type === 'single' || q.type === 'yes_no') return given === key ? w : 0;
  if (q.type === 'number') return Math.abs((given as number) - (key as number)) <= (q.config.tolerance ?? 0) ? w : 0;
  const g = given as string[], k = key as string[];
  const all = q.config.scoring === 'all';
  if (q.type === 'multi') {
    const outOf = Math.min(q.config.pick ?? k.length, k.length);
    const hits = Math.min(g.filter((x) => k.includes(x)).length, outOf);
    if (all) return hits === outOf ? w : 0;
    return Math.floor((w * hits) / outOf);
  }
  if (all) return g.length === k.length && g.every((x, i) => x === k[i]) ? w : 0;
  const exact = k.filter((x, i) => g[i] === x).length;
  return Math.floor((w * exact) / k.length);
}

export interface Ranked { user_id: number; points: number; correct_count: number; rank: number }

export function computeScores(questions: Question[], key: Record<number, AnswerValue>, entries: Map<number, Record<number, AnswerValue>>): Ranked[] {
  const out: Ranked[] = [];
  entries.forEach((answers, user_id) => {
    let points = 0, correct = 0;
    for (const q of questions) {
      const p = scoreAnswer(q, answers[q.id], key[q.id]);
      points += p;
      if (p === q.weight) correct += 1;
    }
    out.push({ user_id, points, correct_count: correct, rank: 0 });
  });
  out.sort((a, b) => b.points - a.points || a.user_id - b.user_id);
  out.forEach((r, i) => { r.rank = i > 0 && r.points === out[i - 1].points ? out[i - 1].rank : i + 1; });
  return out;
}

export const maxPoints = (qs: Question[]) => qs.reduce((a, q) => a + q.weight, 0);
