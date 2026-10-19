// Demo mode must obey the same rules as the real server, or the prototype lies.
import type { AdminRace, RaceDetail, RaceSummary } from '../api/types';
import { demoFetch, resetDemo } from './demoApi';

const call = async <T,>(path: string, method = 'GET', body?: unknown, token: string | null = 'demo.100') => {
  const res = await demoFetch(path, { method, body, token });
  return { status: res.status, body: (await res.json()) as T };
};

// pinned to 19 Oct 2026 (Austin's quiz open), so the demo's real calendar always has the same shape
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] }); vi.setSystemTime(new Date('2026-10-19T12:00:00Z')); resetDemo(); });
afterEach(() => vi.useRealTimers());
const run = <T,>(p: Promise<T>) => { vi.runAllTimers(); return p; };

it('logs in with any 6 digits and rejects 000000', async () => {
  expect((await run(call('/auth/otp/verify', 'POST', { email: 'a@b.co', code: '000000' }, null))).status).toBe(400);
  const ok = await run(call<{ user: { is_admin: boolean } }>('/auth/otp/verify', 'POST', { email: 'a@b.co', code: '123456' }, null));
  expect(ok.status).toBe(200);
});

it('needs a token', async () => {
  expect((await run(call('/races', 'GET', undefined, null))).status).toBe(401);
});

it('saves answers on the open race and validates them', async () => {
  const races = (await run(call<RaceSummary[]>('/races'))).body;
  const open = races.find((r) => r.phase === 'open')!;
  const detail = (await run(call<RaceDetail>(`/races/${open.id}`))).body;
  const [q1, q2] = detail.questions;
  const bad = await run(call<{ errors: Record<string, string> }>(`/races/${open.id}/answers`, 'PUT', { answers: { [q1.id]: 'XXX' } }));
  expect(bad.status).toBe(422);
  expect(Object.keys(bad.body.errors)).toEqual([String(q1.id)]);
  const good = await run(call<{ answers: Record<string, unknown> }>(`/races/${open.id}/answers`, 'PUT', { answers: { [q1.id]: 'LEC', [q2.id]: null } }));
  expect(good.status).toBe(200);
  expect(good.body.answers[q1.id]).toBe('LEC');
  expect(good.body.answers[q2.id]).toBeUndefined();
});

it('locks answers once the admin closes the quiz, then scores exactly once', async () => {
  const races = (await run(call<AdminRace[]>('/admin/races'))).body;
  const open = races.find((r) => r.status === 'open' && Date.parse(r.quiz_opens_at) < Date.now())!;
  expect((await run(call(`/admin/races/${open.id}/close`, 'POST'))).status).toBe(200);
  const detail = (await run(call<RaceDetail>(`/races/${open.id}`))).body;
  expect((await run(call(`/races/${open.id}/answers`, 'PUT', { answers: { [detail.questions[0].id]: 'VER' } }))).status).toBe(409);

  const key = Object.fromEntries(detail.questions.map((q) => [q.id,
    q.type === 'yes_no' ? true : q.type === 'number' ? 18 : q.type === 'single' ? q.options[0] : q.options.slice(0, q.type === 'multi' ? 10 : 3)]));
  const first = await run(call<{ scored: { entries: number } }>(`/admin/races/${open.id}/answer-key`, 'PUT', { answers: key, score: true }));
  expect(first.status).toBe(200);
  expect(first.body.scored.entries).toBeGreaterThan(10);
  expect((await run(call(`/admin/races/${open.id}/score`, 'POST'))).status).toBe(409);
  expect((await run(call(`/admin/races/${open.id}/rescore`, 'POST', { answers: {} }))).status).toBe(200);
});

it('hides other players\' emails from the leaderboard', async () => {
  const s = await run(call<{ rows: Record<string, unknown>[] }>('/standings'));
  expect(s.body.rows.length).toBeGreaterThan(10);
  expect(Object.keys(s.body.rows[0])).not.toContain('email');
});
