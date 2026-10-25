import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, ExternalLink, Lock, Play, Plus, RotateCcw, Save, Send, Trash2, Trophy, Unlock } from 'lucide-react';
import { API_URL, ApiError, DEMO } from '../api/client';
import { admin } from '../api/endpoints';
import type { AdminRaceDetail, AnswerValue, QuestionIn, QuestionType, RaceStatus } from '../api/types';
import { StartLights } from '../components/layout';
import { formatValue, QuestionRenderer, TYPE_LABEL } from '../components/quiz';
import { Badge, Button, ConfirmationDialog, EmptyState, ErrorState, SectionTitle, Skeleton, cx, useToast } from '../components/ui';
import { DRIVER_CODES } from '../fixtures/drivers';
import { keys, useAdminRace, useAdminRaces, useRaceLeaderboard } from '../hooks/queries';
import { validateValue } from '../utils/answers';
import { fmtDateTime } from '../utils/format';

const STATUS_TONE: Record<RaceStatus, 'grey' | 'green' | 'amber' | 'white' | 'red'> = { draft: 'grey', open: 'green', closed: 'amber', scoring: 'amber', scored: 'white' };
// A relative API_URL is the dev proxy (vite.config.ts); the data panel needs the backend itself.
const DATA_PANEL = DEMO ? null : API_URL.startsWith('/') ? 'http://localhost:8000/admin' : `${API_URL}/admin`;

// ---------- list ----------
export function AdminRacesPage() {
  const races = useAdminRaces();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="sector">Admin</p><h1 className="font-display text-5xl font-black uppercase leading-none">Races</h1><div className="stripe mt-3" /></div>
        <div className="flex gap-2">
          {DATA_PANEL && <a href={DATA_PANEL} target="_blank" rel="noreferrer"><Button variant="secondary" iconRight={ExternalLink}>Data panel</Button></a>}
          <Link to="/admin/new"><Button icon={Plus}>New race</Button></Link>
        </div>
      </header>
      {races.isPending ? <Skeleton className="h-80" /> : races.isError ? <ErrorState error={races.error} onRetry={() => races.refetch()} /> : races.data.length === 0 ? (
        <EmptyState icon={Trophy} title="No races yet" action={<Link to="/admin/new"><Button icon={Plus}>Create the first race</Button></Link>} />
      ) : (
        <ol className="space-y-2">
          {races.data.map((r) => (
            <li key={r.id}>
              <Link to={`/admin/races/${r.id}`} className="panel flex flex-wrap items-center gap-4 p-4 transition hover:bg-surface2">
                <span className="num w-12 font-display text-3xl font-black text-muted">R{r.round}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-display text-xl font-bold uppercase">{r.name}</span><span className="text-sm text-muted">Locks {fmtDateTime(r.quiz_closes_at)}</span></span>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}{r.status === 'scored' && !r.published_at ? ' · held' : ''}</Badge>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------- create ----------
const BLANK: QuestionIn = { prompt: '', type: 'single', weight: 10, options: [], config: {} };
const STANDARD: QuestionIn[] = [
  { prompt: 'Who wins the race?', type: 'single', weight: 10, options: DRIVER_CODES, config: {} },
  { prompt: 'Predict the podium', type: 'ranked', weight: 15, options: DRIVER_CODES, config: { pick: 3 } },
  { prompt: 'Pick 3 drivers in the top 10 after lap 10', type: 'multi', weight: 9, options: DRIVER_CODES, config: { pick: 3 } },
  { prompt: 'Will the Safety Car come out?', type: 'yes_no', weight: 5, options: [], config: {} },
  { prompt: 'How many cars finish the race?', type: 'number', weight: 6, options: [], config: { min: 0, max: 22, tolerance: 1 } },
];
const field = 'h-11 w-full rounded-xl border border-line bg-surface2 px-3.5 text-[15px] focus:border-faint focus:outline-none';
const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function QuestionEditor({ q, i, onChange, onRemove }: { q: QuestionIn; i: number; onChange: (q: QuestionIn) => void; onRemove: () => void }) {
  const choice = q.type === 'single' || q.type === 'multi' || q.type === 'ranked';
  const set = (patch: Partial<QuestionIn>) => onChange({ ...q, ...patch });
  const cfg = (patch: Partial<QuestionIn['config']>) => set({ config: { ...q.config, ...patch } });
  return (
    <div className="panel-2 space-y-3 p-4">
      <div className="flex items-center justify-between"><span className="sector">Question {i + 1}</span><button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-muted hover:text-accent-hi" aria-label={`Remove question ${i + 1}`}><Trash2 className="h-4 w-4" /></button></div>
      <input className={field} value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} placeholder="e.g. Who sets the fastest lap?" aria-label="Question" required />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-sm text-muted">Type<select className={cx(field, 'mt-1')} value={q.type} onChange={(e) => {
          const type = e.target.value as QuestionType;
          const keep = q.config.penalty ? { penalty: q.config.penalty } : {};
          set({ type, options: type === 'number' || type === 'yes_no' ? [] : q.options.length ? q.options : DRIVER_CODES, config: { ...keep, ...(type === 'multi' || type === 'ranked' ? { pick: 3 } : type === 'number' ? { min: 0, max: 22, tolerance: 0 } : {}) } });
        }}>{(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
        <label className="text-sm text-muted">Points<input type="number" min={1} max={100} className={cx(field, 'mt-1')} value={q.weight} onChange={(e) => set({ weight: +e.target.value })} /></label>
        <label className="text-sm text-muted">Minus if wrong<input type="number" min={0} max={100} className={cx(field, 'mt-1')} value={q.config.penalty ?? 0}
          onChange={(e) => { const { penalty: _, ...rest } = q.config; const v = Math.max(0, Math.round(+e.target.value || 0)); set({ config: v ? { ...rest, penalty: v } : rest }); }}
          aria-describedby={`penalty-${i}`} /><span id={`penalty-${i}`} className="sr-only">Points taken off a wrong answer. 0 for no negative marking.</span></label>
        {(q.type === 'multi' || q.type === 'ranked') && <label className="text-sm text-muted">Pick<input type="number" min={1} className={cx(field, 'mt-1')} value={q.config.pick ?? 3} onChange={(e) => cfg({ pick: +e.target.value })} /></label>}
        {q.type === 'number' && <>
          <label className="text-sm text-muted">Min<input type="number" className={cx(field, 'mt-1')} value={q.config.min ?? 0} onChange={(e) => cfg({ min: +e.target.value })} /></label>
          <label className="text-sm text-muted">Max<input type="number" className={cx(field, 'mt-1')} value={q.config.max ?? 22} onChange={(e) => cfg({ max: +e.target.value })} /></label>
          <label className="text-sm text-muted">Tolerance (±)<input type="number" min={0} className={cx(field, 'mt-1')} value={q.config.tolerance ?? 0} onChange={(e) => cfg({ tolerance: Math.max(0, +e.target.value || 0) })} /></label>
        </>}
      </div>
      {choice && (
        <label className="block text-sm text-muted">Options, comma-separated (driver codes show as names and team colours)
          <input className={cx(field, 'mt-1')} value={q.options.join(', ')} onChange={(e) => set({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </label>
      )}
    </div>
  );
}

export function AdminNewRacePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const now = new Date();
  const [f, setF] = useState({ season: now.getFullYear(), round: 1, name: '', circuit: '', country: '', opens: toLocal(now), closes: toLocal(new Date(now.getTime() + 3 * 86400000)), reveal: true });
  const [questions, setQuestions] = useState<QuestionIn[]>(STANDARD);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => admin.create({
      season: f.season, round: f.round, name: f.name.trim(), circuit: f.circuit.trim(), country: f.country.trim(),
      quiz_opens_at: new Date(f.opens).toISOString(), quiz_closes_at: new Date(f.closes).toISOString(), reveal_immediately: f.reveal, questions,
    }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: keys.adminRaces }); toast('ok', `${r.name} created as a draft`); nav(`/admin/races/${r.id}`); },
    onError: (e) => setError((e as Error).message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault(); setError(null);
    if (new Date(f.closes) <= new Date(f.opens)) { setError('The quiz must close after it opens.'); return; }
    if (questions.some((q) => q.prompt.trim().length < 3)) { setError('Every question needs its wording.'); return; }
    create.mutate();
  };
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === 'number' ? +e.target.value : e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6" noValidate>
      <Link to="/admin" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Races</Link>
      <h1 className="font-display text-5xl font-black uppercase leading-none">New race</h1>
      <section className="panel grid gap-4 p-5 sm:grid-cols-2">
        <label className="text-sm text-muted">Grand Prix<input className={cx(field, 'mt-1')} value={f.name} onChange={set('name')} placeholder="Las Vegas Grand Prix" required /></label>
        <label className="text-sm text-muted">Circuit<input className={cx(field, 'mt-1')} value={f.circuit} onChange={set('circuit')} placeholder="Las Vegas Strip Circuit" required /></label>
        <label className="text-sm text-muted">Country<input className={cx(field, 'mt-1')} value={f.country} onChange={set('country')} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">Season<input type="number" className={cx(field, 'mt-1')} value={f.season} onChange={set('season')} /></label>
          <label className="text-sm text-muted">Round<input type="number" min={1} className={cx(field, 'mt-1')} value={f.round} onChange={set('round')} /></label>
        </div>
        <label className="text-sm text-muted">Quiz opens (your time)<input type="datetime-local" className={cx(field, 'mt-1')} value={f.opens} onChange={set('opens')} /></label>
        <label className="text-sm text-muted">Quiz locks, normally lights out<input type="datetime-local" className={cx(field, 'mt-1')} value={f.closes} onChange={set('closes')} /></label>
        <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" checked={f.reveal} onChange={set('reveal')} className="h-5 w-5 accent-[#E10600]" />Show results to players as soon as scoring finishes (untick to review first, then publish)</label>
      </section>
      <section className="space-y-3">
        <SectionTitle kicker={`${questions.length} questions`} title="Questions" action={<Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => setQuestions([...questions, { ...BLANK, options: DRIVER_CODES }])}>Add</Button>} />
        {questions.map((q, i) => <QuestionEditor key={i} q={q} i={i} onChange={(n) => setQuestions(questions.map((x, j) => (j === i ? n : x)))} onRemove={() => setQuestions(questions.filter((_, j) => j !== i))} />)}
        <p className="text-sm text-muted">Tip: or create the race with no questions and use "Copy questions from the previous race".</p>
      </section>
      {error && <p role="alert" className="text-sm text-accent-hi">{error}</p>}
      <div className="flex gap-3"><Button type="submit" size="lg" loading={create.isPending}>Create draft</Button><Button type="button" variant="ghost" onClick={() => setQuestions([])}>Clear questions</Button></div>
    </form>
  );
}

// ---------- winners reveal ----------
export function WinnersReveal({ raceId, name }: { raceId: number; name: string }) {
  const lb = useRaceLeaderboard(raceId);
  const [step, setStep] = useState(-1); // -1 idle, 0 drum, 1-5 lights, 6 P3, 7 P2, 8 lights out + P1
  useEffect(() => {
    if (step < 0 || step >= 8) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 1200 : step < 5 ? 550 : step === 5 ? 900 : 1300);
    return () => clearTimeout(t);
  }, [step]);
  if (lb.isPending) return <Skeleton className="h-80" />;
  if (lb.isError) return <ErrorState error={lb.error} />;
  const byRank = (r: number) => lb.data.rows.filter((x) => x.rank === r);
  const ranks = [...new Set(lb.data.rows.map((x) => x.rank))].slice(0, 3);
  const [p1, p2, p3] = [byRank(ranks[0]), byRank(ranks[1] ?? -1), byRank(ranks[2] ?? -1)];
  const shown = (place: number) => step >= 8 || (place === 3 && step >= 6) || (place === 2 && step >= 7);
  const lit = step >= 1 && step <= 7 ? Math.min(step, 5) : 0;
  const text = step < 0 ? 'Who takes the podium?' : step === 0 ? 'Drum roll…' : step < 6 ? 'Lights on…' : step === 6 ? 'Third place…' : step === 7 ? 'Second place…' : `${p1.map((x) => x.name).join(' and ')} ${p1.length > 1 ? 'share' : 'wins'} ${name}`;
  const idle = step < 0;
  const block = (place: number, rows: typeof p1, h: string) => (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className={cx('min-h-[64px] transition-all duration-500', idle || shown(place) ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0')}>
        {idle ? <p className="font-display text-3xl font-bold text-white/50">?</p> : (<>
          {rows.map((r) => <p key={r.user_id} className="font-display text-lg font-bold uppercase leading-tight sm:text-2xl">{r.name}</p>)}
          <p className="num text-sm text-white/70">{rows[0]?.points ?? 0} pts</p>
        </>)}
      </div>
      <div className={cx('relative w-full origin-bottom rounded-t-2xl bg-bg/90 pt-3', h, idle ? '' : shown(place) ? 'animate-grow' : 'scale-y-[.06]')}>
        <span className="font-display text-4xl font-black">{place}</span>
      </div>
    </div>
  );
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-accent p-6 text-white sm:p-10">
      <div className="absolute right-0 top-0 h-full w-28 opacity-10 [background:repeating-conic-gradient(#000_0_25%,transparent_0_50%)_0_0/28px_28px]" aria-hidden />
      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <StartLights lit={lit} size={18} />
          <Button variant="secondary" icon={step < 0 ? Play : RotateCcw} onClick={() => setStep(0)} className="bg-bg text-white hover:bg-surface">{step < 0 ? 'Play winners reveal' : 'Replay'}</Button>
        </div>
        <p className={cx('min-h-[2.2em] font-display text-4xl font-black uppercase leading-none sm:text-5xl', step >= 0 && step < 8 && 'animate-drum')} aria-live="polite">{text}</p>
        {lb.data.rows.length ? (
          <div className="grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-4">
            {block(2, p2, 'h-28 sm:h-36')}{block(1, p1, 'h-40 sm:h-52')}{block(3, p3, 'h-20 sm:h-28')}
          </div>
        ) : <p>No entries were scored for this race.</p>}
      </div>
    </section>
  );
}

// ---------- race control ----------
const STEPS: [string, (r: AdminRaceDetail) => boolean][] = [
  ['Draft', () => true],
  ['Open', (r) => r.status !== 'draft'],
  ['Locked', (r) => ['closed', 'scoring', 'scored'].includes(r.status) || Date.now() >= Date.parse(r.quiz_closes_at)],
  ['Scored', (r) => r.status === 'scored'],
  ['Published', (r) => !!r.published_at],
];

export function AdminRacePage() {
  const id = Number(useParams().id);
  const race = useAdminRace(id);
  const qc = useQueryClient();
  const toast = useToast();
  const [key, setKey] = useState<Record<string, AnswerValue>>({});
  const [confirm, setConfirm] = useState<null | 'open' | 'close' | 'score' | 'rescore'>(null);
  useEffect(() => { if (race.data) setKey(race.data.answer_key); }, [race.data]);

  const refresh = () => { qc.invalidateQueries({ queryKey: keys.adminRace(id) }); qc.invalidateQueries({ queryKey: keys.adminRaces }); qc.invalidateQueries({ queryKey: keys.races }); qc.invalidateQueries({ queryKey: keys.standings }); qc.invalidateQueries({ queryKey: keys.leaderboard(id) }); };
  const act = useMutation({
    mutationFn: async (kind: 'open' | 'close' | 'copy' | 'draft' | 'score' | 'rescore' | 'publish') => {
      const r = race.data!;
      const changed = Object.fromEntries(Object.entries(key).filter(([qid, v]) => JSON.stringify(r.answer_key[qid]) !== JSON.stringify(v)));
      if (kind === 'open') return admin.open(id).then(() => 'Quiz is open to players');
      if (kind === 'close') return admin.close(id).then(() => 'Answers locked');
      if (kind === 'copy') return admin.copyQuestions(id).then((x) => `Copied ${x.copied} questions`);
      if (kind === 'draft') return admin.saveKey(id, changed).then(() => 'Results saved as a draft. Nothing is scored yet.');
      if (kind === 'score') return admin.saveKey(id, changed, true).then((x) => `Scored ${x.scored?.entries} entries${x.scored?.published ? ' and published' : '. Held for review.'}`);
      if (kind === 'rescore') return admin.rescore(id, changed).then((x) => `Re-scored ${x.entries} entries`);
      return admin.publish(id).then(() => 'Results published to every player');
    },
    onSuccess: (msg) => { setConfirm(null); toast('ok', msg); refresh(); },
    onError: (e) => { setConfirm(null); toast('error', (e as ApiError).errors ? 'Some results need fixing (marked below).' : (e as Error).message); },
  });
  const keyErrors = useMemo(() => {
    const out: Record<string, string> = {};
    race.data?.questions.forEach((q) => { const v = key[q.id]; if (v !== undefined) { const e = validateValue(q, v, true); if (e) out[q.id] = e; } });
    return out;
  }, [key, race.data]);

  if (race.isPending) return <Skeleton className="h-[600px]" />;
  if (race.isError) return <ErrorState error={race.error} onRetry={() => race.refetch()} />;
  const r = race.data;
  const locked = STEPS[2][1](r);
  const missing = r.questions.filter((q) => key[q.id] === undefined).length;
  const canEditKey = locked;
  const hasErrors = Object.keys(keyErrors).length > 0;

  return (
    <div className="space-y-6">
      <Link to="/admin" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Races</Link>
      <header className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="sector">Round {r.round} · {r.entries} entries</p><h1 className="font-display text-4xl font-black uppercase leading-none sm:text-5xl">{r.name}</h1><p className="mt-1 text-muted">Locks {fmtDateTime(r.quiz_closes_at)}</p></div>
          <div className="flex flex-wrap gap-2">
            {r.status === 'draft' && r.questions.length === 0 && <Button variant="secondary" icon={Copy} loading={act.isPending} onClick={() => act.mutate('copy')}>Copy previous questions</Button>}
            {r.status === 'draft' && <Button icon={Unlock} onClick={() => setConfirm('open')}>Open quiz</Button>}
            {r.status === 'open' && !locked && <Button variant="danger" icon={Lock} onClick={() => setConfirm('close')}>Close now</Button>}
            {r.status === 'scored' && !r.published_at && <Button icon={Send} loading={act.isPending} onClick={() => act.mutate('publish')}>Publish results</Button>}
          </div>
        </div>
        <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Race status">
          {STEPS.map(([label, done]) => (
            <li key={label}><span className={cx('block h-1.5 rounded-full', done(r) ? 'bg-accent' : 'bg-surface3')} /><span className={cx('mt-2 block text-xs font-semibold sm:text-sm', done(r) ? 'text-ink' : 'text-faint')}>{label}</span></li>
          ))}
        </ol>
      </header>

      {r.status === 'scored' && <WinnersReveal raceId={r.id} name={r.name} />}

      <section>
        <SectionTitle kicker={canEditKey ? 'Answer key' : 'Questions'} title={canEditKey ? 'Race results' : `${r.questions.length} questions`}
          action={DATA_PANEL ? <a href={DATA_PANEL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">Edit questions<ExternalLink className="h-3.5 w-3.5" /></a> : undefined} />
        {!canEditKey && <p className="mb-4 text-sm text-muted">You can enter results once the quiz locks at lights out. Players can't see the answer key until results are published.</p>}
        {r.questions.length === 0 ? <EmptyState icon={Copy} title="No questions yet" body="Copy them from the previous race, or add them in the data panel." /> : (
          <ol className="space-y-3">
            {r.questions.map((q) => (
              <li key={q.id} className="panel p-5">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="sector">Q{q.sequence} · {TYPE_LABEL[q.type]} · +{q.weight} pts{q.config.penalty ? ` / −${q.config.penalty}` : ''}</span>
                  {canEditKey && (key[q.id] === undefined ? <Badge tone="amber">Missing</Badge>
                    : keyErrors[q.id] ? <Badge tone="red">Check</Badge>
                    : JSON.stringify(key[q.id]) !== JSON.stringify(r.answer_key[q.id]) ? <Badge tone="green">Edited · not saved</Badge>
                    : r.answer_key_sources?.[q.id] === 'openf1_live' ? <Badge tone="amber" dot>Live · can change</Badge>
                    : r.answer_key_sources?.[q.id] === 'openf1' ? <Badge tone="green">OpenF1 · official</Badge>
                    : <Badge tone="green">Set by you</Badge>)}
                </div>
                <p className="mb-4 text-lg font-semibold">{q.prompt}</p>
                {canEditKey ? (
                  <QuestionRenderer q={q} isKey value={key[q.id]} onChange={(v) => setKey((k) => { const n = { ...k }; if (v === null) delete n[q.id]; else n[q.id] = v; return n; })} />
                ) : <p className="text-sm text-muted">{q.options.length ? `${q.options.length} options` : TYPE_LABEL[q.type]}</p>}
                {keyErrors[q.id] && <p className="mt-3 text-sm text-accent-hi">{keyErrors[q.id]}</p>}
                {canEditKey && key[q.id] !== undefined && <p className="mt-3 text-sm text-muted">Result: <span className="font-semibold text-ink">{formatValue(q, key[q.id])}</span></p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {canEditKey && r.questions.length > 0 && (
        <div className="sticky bottom-[calc(var(--tabbar)+0.75rem)] z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur md:bottom-4">
          <span className="flex-1 px-2 text-sm text-muted">{missing ? `${missing} result${missing > 1 ? 's' : ''} still missing` : hasErrors ? 'Fix the marked results' : 'All results entered'}</span>
          {r.status !== 'scored' ? (<>
            <Button variant="secondary" icon={Save} loading={act.isPending && act.variables === 'draft'} disabled={hasErrors} onClick={() => act.mutate('draft')}>Save draft</Button>
            <Button icon={Trophy} disabled={missing > 0 || hasErrors} onClick={() => setConfirm('score')}>Save and score</Button>
          </>) : <Button variant="danger" icon={RotateCcw} disabled={hasErrors} onClick={() => setConfirm('rescore')}>Re-score</Button>}
        </div>
      )}

      <ConfirmationDialog open={confirm === 'open'} title="Open the quiz?" confirmLabel="Open quiz" loading={act.isPending} onClose={() => setConfirm(null)} onConfirm={() => act.mutate('open')}
        body={`Players will see ${r.name} and can answer from ${fmtDateTime(r.quiz_opens_at)}. Question options are locked once it's open.`} />
      <ConfirmationDialog open={confirm === 'close'} title="Lock answers now?" tone="danger" confirmLabel="Lock answers" loading={act.isPending} onClose={() => setConfirm(null)} onConfirm={() => act.mutate('close')}
        body="Nobody can change their answers after this, even before the deadline." />
      <ConfirmationDialog open={confirm === 'score'} title="Score the race?" confirmLabel="Save and score" loading={act.isPending} onClose={() => setConfirm(null)} onConfirm={() => act.mutate('score')}
        body={r.reveal_immediately ? `All ${r.entries} entries are scored and results go live to players straight away.` : `All ${r.entries} entries are scored. Results stay hidden until you publish them.`} />
      <ConfirmationDialog open={confirm === 'rescore'} title="Re-score the race?" tone="danger" confirmLabel="Re-score" loading={act.isPending} onClose={() => setConfirm(null)} onConfirm={() => act.mutate('rescore')}
        body="Every player's points and the standings are recalculated from the results above. Use this when a penalty changes the classification." />
    </div>
  );
}
