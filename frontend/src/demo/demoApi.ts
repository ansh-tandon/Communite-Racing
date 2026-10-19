// DEMO MODE ONLY. An in-browser stand-in for the FastAPI backend: same paths, same status
// codes, same rules (deadline lock, validation, exactly-once scoring, held reveal, re-score).
// Every name, answer and score here is sample data and the UI labels it as such.
import type { AdminRace, AnswerValue, Question, QuestionIn, RaceIn, User } from '../api/types';
import { computeScores, maxPoints, scoreAnswer, validateValue, type Ranked } from '../utils/answers';
import { DRIVER_CODES } from '../fixtures/drivers';
import { CALENDAR } from '../fixtures/circuits';

const ME = 100;
const HOUR = 3_600_000, DAY = 24 * HOUR;
const NAMES = ['Meera S.', 'Jonas W.', 'Diego R.', 'Aiko T.', 'Priya N.', 'Tom B.', 'Lucía F.', 'Kwame A.', 'Sofia L.', 'Arjun M.',
  'Hannah K.', 'Mateo G.', 'Yuki H.', 'Chloe D.', 'Ravi P.', 'Elena V.', 'Omar F.', 'Isla M.', 'Noah C.', 'Ana P.', 'Felix O.',
  'Zara Q.', 'Luca B.', 'Grace Y.', 'Ibrahim K.', 'Nina J.', 'Kenji S.', 'Maya R.', 'Ethan W.', 'Leila H.', 'Pablo M.', 'Freya N.',
  'Dev A.', 'Sara L.', 'Marco T.', 'Amara E.', 'Hugo D.', 'Inès C.', 'Ollie G.', 'Tara V.'];

type Key = Record<number, AnswerValue>;
interface DB {
  users: User[];
  races: AdminRace[];
  questions: Record<number, Question[]>;
  answers: Record<string, Key>; // `${raceId}:${userId}`
  keys: Record<number, Key>;
  scores: Record<number, Ranked[]>;
  nextQ: number;
  nextRace: number;
}

// ---------- seed ----------
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const shuffle = <T,>(a: T[]) => [...a].sort(() => rand() - 0.5);

const FRONT = ['NOR', 'PIA', 'VER', 'LEC', 'RUS', 'HAM', 'ANT', 'ALO', 'HAD', 'SAI'];
function template(): QuestionIn[] {
  return [
    { prompt: 'Who wins the race?', type: 'single', weight: 10, options: FRONT, config: {} },
    { prompt: 'Predict the podium', type: 'ranked', weight: 15, options: FRONT, config: { pick: 3 } },
    { prompt: 'Pick 3 drivers in the top 10 after lap 10', type: 'multi', weight: 9, options: DRIVER_CODES, config: { pick: 3 } },
    { prompt: 'Will the Safety Car come out?', type: 'yes_no', weight: 5, options: [], config: {} },
    { prompt: 'How many cars finish the race?', type: 'number', weight: 6, options: [], config: { min: 10, max: 22, tolerance: 1 } },
    { prompt: 'Who sets the fastest lap?', type: 'single', weight: 5, options: FRONT, config: {} },
    { prompt: 'Will both Ferraris finish in the points?', type: 'yes_no', weight: 5, options: [], config: {} },
  ];
}

function randomAnswer(q: Question): AnswerValue {
  if (q.type === 'single') return pick(q.options.slice(0, 6));
  if (q.type === 'yes_no') return rand() > 0.45;
  if (q.type === 'number') return 14 + Math.floor(rand() * 6);
  if (q.type === 'ranked') return shuffle(q.options.slice(0, 6)).slice(0, 3);
  return shuffle(q.options.slice(0, 12)).slice(0, 3);
}
function randomKey(q: Question): AnswerValue {
  if (q.type === 'multi') return shuffle(q.options.slice(0, 13)).slice(0, 10);
  return randomAnswer(q);
}

function build(): DB {
  const now = Date.now();
  const db: DB = { users: [], races: [], questions: {}, answers: {}, keys: {}, scores: {}, nextQ: 1, nextRace: 1 };
  NAMES.forEach((n, i) => db.users.push({ id: i + 1, email: `player${i + 1}@example.com`, display_name: n, is_admin: false }));
  db.users.push({ id: ME, email: 'you@example.com', display_name: null, is_admin: true }); // you; admin so the admin screens can be tried
  // The real 2026 calendar from Baku (round 15) on, with official lights-out times. Each quiz
  // opens a week before lights out and locks at lights out. Races already run when the demo
  // starts are scored and published; the one in its window is open; the rest are coming up.
  const circuits: Record<string, [circuit: string, country: string]> = {
    Baku: ['Baku City Circuit', 'Azerbaijan'],
    Sepang: ['Sepang International Circuit', 'Malaysia'],
    Singapore: ['Marina Bay Street Circuit', 'Singapore'],
    Austin: ['Circuit of the Americas', 'United States'],
    'Mexico City': ['Autódromo Hermanos Rodríguez', 'Mexico'],
    'São Paulo': ['Autódromo José Carlos Pace', 'Brazil'],
    'Las Vegas': ['Las Vegas Strip Circuit', 'United States'],
    Lusail: ['Lusail International Circuit', 'Qatar'],
    'Abu Dhabi': ['Yas Marina Circuit', 'United Arab Emirates'],
  };
  for (const c of CALENDAR.filter((r) => r.start && circuits[r.city])) {
    const id = db.nextRace++;
    const closes = Date.parse(c.start!);
    const opens = closes - 7 * DAY;
    const [circuit, country] = circuits[c.city];
    db.races.push({
      id, season: 2026, round: c.round, name: c.gp, circuit, country,
      quiz_opens_at: new Date(opens).toISOString(),
      quiz_closes_at: new Date(closes).toISOString(),
      status: closes < now ? 'scored' : 'open',
      reveal_immediately: true, published_at: null,
    });
    db.questions[id] = template().map((q, i) => ({ ...q, id: db.nextQ++, sequence: i + 1 }));
    if (opens > now) continue; // not open yet: nobody has answered
    const qs = db.questions[id];
    for (const u of db.users) if (rand() > 0.12) db.answers[`${id}:${u.id}`] = Object.fromEntries(qs.map((q) => [q.id, randomAnswer(q)]));
    if (closes < now) {
      db.answers[`${id}:${ME}`] = Object.fromEntries(qs.map((q) => [q.id, randomAnswer(q)]));
      db.keys[id] = Object.fromEntries(qs.map((q) => [q.id, randomKey(q)]));
      db.scores[id] = scoreRace(db, id);
      db.races.find((r) => r.id === id)!.published_at = new Date(Math.min(closes + 3 * HOUR, now)).toISOString();
    } else {
      // the open race: you've answered a few already
      db.answers[`${id}:${ME}`] = { [qs[0].id]: 'NOR', [qs[1].id]: ['NOR', 'VER', 'PIA'], [qs[3].id]: true };
    }
  }
  return db;
}

function scoreRace(db: DB, raceId: number): Ranked[] {
  const entries = new Map<number, Key>();
  for (const [k, v] of Object.entries(db.answers)) {
    const [r, u] = k.split(':').map(Number);
    if (r === raceId) entries.set(u, v);
  }
  return computeScores(db.questions[raceId], db.keys[raceId], entries);
}

const STORE = 'crql.demo.v1';
let db: DB = (() => {
  try { const s = sessionStorage.getItem(STORE); if (s) return JSON.parse(s) as DB; } catch { /* ignore */ }
  return build();
})();
const persist = () => { try { sessionStorage.setItem(STORE, JSON.stringify(db)); } catch { /* ignore */ } };
export const resetDemo = () => { try { sessionStorage.removeItem(STORE); } catch { /* ignore */ } seed = 7; db = build(); persist(); };

// ---------- helpers ----------
class HttpError { constructor(public status: number, public detail: string, public errors?: Record<string, string>) {} }
const fail = (status: number, detail: string, errors?: Record<string, string>): never => { throw new HttpError(status, detail, errors); };
const nowIso = () => new Date().toISOString();
const name = (u: User) => u.display_name ?? `Player ${u.id}`;

function me(token: string | null): User {
  const id = token?.startsWith('demo.') ? Number(token.slice(5)) : NaN;
  const u = db.users.find((x) => x.id === id);
  if (!u) fail(401, 'Please log in again.');
  return u!;
}
function race(id: number, user: User): AdminRace {
  const r = db.races.find((x) => x.id === id);
  if (!r || (r.status === 'draft' && !user.is_admin)) fail(404, 'Race not found.');
  return r!;
}
function phase(r: AdminRace) {
  const now = Date.now();
  if (r.published_at) return 'results';
  if (['closed', 'scoring', 'scored'].includes(r.status) || now >= Date.parse(r.quiz_closes_at)) return 'closed';
  if (now < Date.parse(r.quiz_opens_at)) return 'upcoming';
  return 'open';
}
function summary(r: AdminRace, user: User) {
  const mine = db.answers[`${r.id}:${user.id}`] ?? {};
  const sc = r.published_at ? db.scores[r.id]?.find((s) => s.user_id === user.id) : undefined;
  return {
    id: r.id, season: r.season, round: r.round, name: r.name, circuit: r.circuit, country: r.country,
    quiz_opens_at: r.quiz_opens_at, quiz_closes_at: r.quiz_closes_at, phase: phase(r),
    question_count: db.questions[r.id].length, answered_count: Object.keys(mine).length,
    my_points: sc?.points ?? null, my_rank: sc?.rank ?? null,
  };
}
function checkValues(raceId: number, values: Record<string, unknown>, isKey: boolean) {
  const qs = db.questions[raceId];
  const errors: Record<string, string> = {};
  for (const [qid, v] of Object.entries(values)) {
    const q = qs.find((x) => x.id === Number(qid));
    if (!q) errors[qid] = 'Not a question in this race.';
    else if (v !== null) { const e = validateValue(q, v, isKey); if (e) errors[qid] = e; }
  }
  if (Object.keys(errors).length) fail(422, "Some answers aren't valid.", errors);
}
function merge(target: Key, values: Record<string, AnswerValue | null>) {
  for (const [qid, v] of Object.entries(values)) { if (v === null) delete target[Number(qid)]; else target[Number(qid)] = v; }
}
function adminDetail(r: AdminRace) {
  return { ...r, entries: Object.keys(db.answers).filter((k) => k.startsWith(`${r.id}:`)).length, questions: db.questions[r.id], answer_key: db.keys[r.id] ?? {} };
}
function doScore(r: AdminRace, rescore: boolean) {
  const closed = r.status === 'closed' || (r.status === 'open' && Date.now() >= Date.parse(r.quiz_closes_at));
  if (rescore ? r.status !== 'scored' : !closed) {
    if (rescore) fail(409, 'Score the race before re-scoring it.');
    if (r.status === 'scored') fail(409, 'This race is already scored. Use re-score to change results.');
    if (r.status === 'open') fail(409, 'The quiz is still open. Close it or wait for the deadline.');
    fail(409, 'This quiz was never opened.');
  }
  const qs = db.questions[r.id], key = db.keys[r.id] ?? {};
  const missing = qs.filter((q) => key[q.id] === undefined).map((q) => `Q${q.sequence}`);
  if (missing.length) fail(409, `Enter results for every question first. Missing: ${missing.join(', ')}.`);
  db.scores[r.id] = scoreRace(db, r.id);
  r.status = 'scored';
  if (r.reveal_immediately && !r.published_at) r.published_at = nowIso();
  return { race_id: r.id, entries: db.scores[r.id].length, max_points: maxPoints(qs), published: !!r.published_at, rescored: rescore };
}

// ---------- router ----------
type Req = { method: string; body?: unknown; token: string | null };
function handle(path: string, { method, body, token }: Req): unknown {
  const url = new URL(path, 'http://demo');
  const p = url.pathname, b = (body ?? {}) as Record<string, any>;
  let m: RegExpMatchArray | null;

  if (p === '/auth/otp/request' && method === 'POST') {
    if (!/^\S+@\S+\.\S+$/.test(String(b.email ?? ''))) fail(422, 'Enter a valid email address.');
    return { sent: true };
  }
  if (p === '/auth/otp/verify' && method === 'POST') {
    if (!/^\d{6}$/.test(String(b.code ?? ''))) fail(422, 'The code is 6 digits.');
    if (b.code === '000000') fail(400, 'Wrong code. 4 tries left.');
    const u = db.users.find((x) => x.id === ME)!;
    u.email = String(b.email).trim().toLowerCase();
    return { access_token: `demo.${ME}`, token_type: 'bearer', user: u };
  }
  if (p === '/auth/google' && method === 'POST') {
    return { access_token: `demo.${ME}`, token_type: 'bearer', user: db.users.find((x) => x.id === ME)! };
  }
  const user = me(token);
  if (p === '/auth/me') {
    if (method === 'PATCH') {
      const n = String(b.display_name ?? '').replace(/\s+/g, ' ').trim();
      if (n.length < 2 || n.length > 24) fail(422, 'Name must be 2 to 24 characters.');
      user.display_name = n;
    }
    return user;
  }
  if (p === '/races') {
    return db.races.filter((r) => r.status !== 'draft').sort((a, b2) => b2.round - a.round).map((r) => summary(r, user));
  }
  if ((m = p.match(/^\/races\/(\d+)$/))) {
    const r = race(+m[1], user), qs = db.questions[r.id], mine = db.answers[`${r.id}:${user.id}`] ?? {};
    let results = null;
    if (r.published_at) {
      const key = db.keys[r.id], sc = db.scores[r.id].find((s) => s.user_id === user.id);
      results = {
        answer_key: key, max_points: maxPoints(qs), points: sc?.points ?? null, rank: sc?.rank ?? null,
        points_by_question: Object.fromEntries(qs.map((q) => [q.id, scoreAnswer(q, mine[q.id], key[q.id])])),
      };
    }
    return { ...summary(r, user), server_time: nowIso(), entries: adminDetail(r).entries, questions: qs, my_answers: mine, results,
      my_points: results?.points ?? null, my_rank: results?.rank ?? null };
  }
  if ((m = p.match(/^\/races\/(\d+)\/answers$/)) && method === 'PUT') {
    const r = race(+m[1], user);
    if (r.status !== 'open' || Date.now() >= Date.parse(r.quiz_closes_at)) fail(409, 'The quiz is closed. Answers are locked.');
    if (Date.now() < Date.parse(r.quiz_opens_at)) fail(409, "The quiz isn't open yet.");
    checkValues(r.id, b.answers ?? {}, false);
    const k = `${r.id}:${user.id}`; db.answers[k] = db.answers[k] ?? {}; merge(db.answers[k], b.answers);
    return { answers: db.answers[k] };
  }
  if ((m = p.match(/^\/races\/(\d+)\/leaderboard$/))) {
    const r = race(+m[1], user);
    if (!r.published_at && !(user.is_admin && r.status === 'scored')) fail(403, "Results aren't published yet.");
    const rows = (db.scores[r.id] ?? []).map((s) => ({ ...s, name: name(db.users.find((u) => u.id === s.user_id)!) }));
    return { race_id: r.id, published: !!r.published_at, rows };
  }
  if (p === '/standings') {
    const tot = new Map<number, { points: number; races: number; wins: number; podiums: number }>();
    for (const r of db.races.filter((x) => x.published_at)) for (const s of db.scores[r.id] ?? []) {
      const t = tot.get(s.user_id) ?? { points: 0, races: 0, wins: 0, podiums: 0 };
      t.points += s.points; t.races += 1; t.wins += s.rank === 1 ? 1 : 0; t.podiums += s.rank <= 3 ? 1 : 0;
      tot.set(s.user_id, t);
    }
    const rows = [...tot.entries()].map(([user_id, t]) => ({ user_id, name: name(db.users.find((u) => u.id === user_id)!), ...t, rank: 0 }))
      .sort((a, b2) => b2.points - a.points || b2.wins - a.wins);
    rows.forEach((r, i) => { r.rank = i > 0 && r.points === rows[i - 1].points ? rows[i - 1].rank : i + 1; });
    return { season: 2026, rows };
  }

  // ---------- admin ----------
  if (p.startsWith('/admin')) {
    if (!user.is_admin) fail(403, 'Admins only.');
    if (p === '/admin/races' && method === 'GET') return [...db.races].sort((a, b2) => b2.round - a.round);
    if (p === '/admin/races' && method === 'POST') {
      const body2 = b as RaceIn;
      if (db.races.some((r) => r.season === body2.season && r.round === body2.round)) fail(409, `Round ${body2.round} of ${body2.season} already exists.`);
      const r: AdminRace = { id: db.nextRace++, season: body2.season, round: body2.round, name: body2.name, circuit: body2.circuit, country: body2.country,
        quiz_opens_at: body2.quiz_opens_at, quiz_closes_at: body2.quiz_closes_at, status: 'draft', reveal_immediately: body2.reveal_immediately, published_at: null };
      db.races.push(r);
      db.questions[r.id] = body2.questions.map((q, i) => ({ ...q, id: db.nextQ++, sequence: q.sequence ?? i + 1 }));
      return adminDetail(r);
    }
    m = p.match(/^\/admin\/races\/(\d+)(\/[a-z-]+)?$/);
    if (!m) fail(404, 'Not found.');
    const r = db.races.find((x) => x.id === +m![1]) ?? fail(404, 'Race not found.');
    const action = m![2];
    if (!action) return adminDetail(r);
    if (action === '/open') { if (r.status !== 'draft') fail(409, `This quiz is already ${r.status}.`); if (!db.questions[r.id].length) fail(409, 'Add at least one question before opening the quiz.'); r.status = 'open'; return r; }
    if (action === '/close') { if (r.status !== 'open') fail(409, `Only an open quiz can be closed. This one is ${r.status}.`); r.status = 'closed'; return r; }
    if (action === '/copy-questions') {
      if (r.status !== 'draft') fail(409, 'Questions can only be copied into a draft race.');
      if (db.questions[r.id].length) fail(409, 'This race already has questions. Delete them first to copy again.');
      const src = db.races.filter((x) => x.round < r.round && db.questions[x.id].length).sort((a, b2) => b2.round - a.round)[0] ?? fail(404, 'No earlier race with questions to copy from.');
      db.questions[r.id] = db.questions[src.id].map((q) => ({ ...q, id: db.nextQ++ }));
      return { copied: db.questions[r.id].length };
    }
    if (action === '/answer-key') {
      if (r.status === 'draft') fail(409, 'Open the quiz before entering results.');
      if (Object.keys(b.answers ?? {}).length) {
        if (r.status === 'scored') fail(409, 'This race is already scored. Use re-score to change results.');
        checkValues(r.id, b.answers, true);
        db.keys[r.id] = db.keys[r.id] ?? {}; merge(db.keys[r.id], b.answers);
      }
      return { answer_key: db.keys[r.id] ?? {}, scored: b.score ? doScore(r, false) : null };
    }
    if (action === '/score') return doScore(r, false);
    if (action === '/rescore') {
      if (r.status !== 'scored') fail(409, 'Score the race before re-scoring it.');
      if (Object.keys(b.answers ?? {}).length) { checkValues(r.id, b.answers, true); merge(db.keys[r.id], b.answers); }
      return doScore(r, true);
    }
    if (action === '/publish') { if (r.status !== 'scored') fail(409, 'Score the race before publishing results.'); r.published_at = r.published_at ?? nowIso(); return r; }
  }
  return fail(404, 'Not found.');
}

export async function demoFetch(path: string, req: Req): Promise<Response> {
  await new Promise((r) => setTimeout(r, 180 + Math.random() * 260));
  try {
    const data = handle(path, req);
    persist();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    if (e instanceof HttpError) {
      return new Response(JSON.stringify({ detail: e.detail, ...(e.errors ? { errors: e.errors } : {}) }), { status: e.status, headers: { 'Content-Type': 'application/json' } });
    }
    throw e;
  }
}
