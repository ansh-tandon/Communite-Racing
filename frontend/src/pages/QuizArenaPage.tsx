import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDashed, Cloud, CloudOff, Flag, Lock, Timer, Trophy, Users } from 'lucide-react';
import type { AnswerValue, Question, RaceDetail } from '../api/types';
import { Countdown, RaceStatusBadge } from '../components/race';
import { describe, formatValue, penaltyLabel, QuestionRenderer, TYPE_LABEL } from '../components/quiz';
import { PredictionPass } from '../components/pass';
import { Button, EmptyState, ErrorState, Skeleton, cx } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useAutosave, type SaveState } from '../hooks/useAutosave';
import { useRace, useRaces } from '../hooks/queries';
import { isComplete, maxPoints } from '../utils/answers';
import { featuredRace, fmtDateTime, ordinal, two } from '../utils/format';
import { LazyGlobe, racePin, seasonMarkers } from '../components/LazyGlobe';

/** Opening a quiz: find the race on the globe, then start (or carry on). */
function RaceIntro({ race, answered, onStart }: { race: RaceDetail; answered: number; onStart: () => void }) {
  const place = racePin(race);
  const season = useRaces().data;
  const total = maxPoints(race.questions);
  const open = race.phase === 'open';
  const n = race.questions.length;
  const action = !open ? 'Preview the questions'
    : answered === 0 ? 'Start predictions'
    : answered < n ? `Continue · ${answered} of ${n} answered`
    : 'View your Prediction Pass';
  return (
    <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14 lg:py-6" aria-labelledby="race-intro">
      <LazyGlobe target={place} markers={season && seasonMarkers(season)} route flyIn
        className="mx-auto aspect-square w-full max-w-[min(100%,40svh)] lg:max-w-[560px]" />
      <div className="min-w-0">
        <p className="text-[15px] text-muted">Round {race.round} · {race.circuit}</p>
        <h1 id="race-intro" className="mt-3 font-display text-[clamp(3rem,12vw,7rem)] font-black uppercase leading-[0.9] tracking-tight">
          {race.name.replace(/\s+grand prix$/i, '')}
        </h1>
        <p className="mt-5 max-w-md text-lg">
          {n} questions, {total} points to play for{race.questions.some((x) => x.config.penalty) && <>. Wrong answers lose points, so skip what you don't know</>}{race.entries > 0 && <>. {race.entries} {race.entries === 1 ? 'player is' : 'players are'} in</>}. Your picks save as you tap.
        </p>
        {open ? (
          <div className="mt-6">
            <p className="mb-2 text-[15px] text-muted">Picks lock at lights out</p>
            <Countdown to={race.quiz_closes_at} serverTime={race.server_time} />
          </div>
        ) : (
          <p className="mt-6 text-[15px] text-muted">The quiz opens {fmtDateTime(race.quiz_opens_at)}. You can look at the questions now.</p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button size="lg" iconRight={ArrowRight} onClick={onStart} className="max-sm:w-full">{action}</Button>
          <Link to={`/races/${race.id}`} className="inline-flex min-h-[44px] items-center text-[15px] font-semibold text-muted hover:text-ink">Race hub</Link>
        </div>
        {!place && <p className="mt-4 text-sm text-muted">This circuit isn't on the map yet.</p>}
      </div>
    </section>
  );
}

/** /quiz with no id: send the player to the quiz that matters now. */
export function QuizIndex() {
  const races = useRaces();
  if (races.isPending) return <Skeleton className="h-96" />;
  if (races.isError) return <ErrorState error={races.error} onRetry={() => races.refetch()} />;
  const r = featuredRace(races.data);
  if (!r) return <EmptyState icon={Flag} title="No quiz right now" body="The next race's quiz appears here as soon as it's published." />;
  return <Navigate to={`/quiz/${r.id}`} replace />;
}

function SaveIndicator({ state, savedAt, message, onRetry }: { state: SaveState; savedAt: Date | null; message: string | null; onRetry: () => void }) {
  if (state === 'saving') return <span className="flex items-center gap-1.5 text-sm text-muted"><CircleDashed className="h-4 w-4 animate-spin" aria-hidden />Saving…</span>;
  if (state === 'error') return <button onClick={onRetry} className="-my-2 flex min-h-[44px] items-center gap-1.5 text-sm text-accent-hi"><CloudOff className="h-4 w-4" aria-hidden />{message ?? 'Not saved'} · Retry</button>;
  if (state === 'locked') return <span className="flex items-center gap-1.5 text-sm text-warn"><Lock className="h-4 w-4" aria-hidden />Locked</span>;
  if (state === 'saved' && savedAt) return <span className="flex items-center gap-1.5 text-sm text-ok"><Cloud className="h-4 w-4" aria-hidden />Saved {two(savedAt.getHours())}:{two(savedAt.getMinutes())}</span>;
  return <span className="flex items-center gap-1.5 text-sm text-muted"><Cloud className="h-4 w-4" aria-hidden />Saves as you tap</span>;
}

/** One segment per question. The bars are thin; each button around them is a full 44px tap target. */
function Segments({ questions, answers, current, onJump, results }: {
  questions: Question[]; answers: Record<string, AnswerValue>; current: number; onJump: (i: number) => void; results?: Record<string, number>;
}) {
  return (
    <div className="-my-3 flex gap-1" role="tablist" aria-label="Questions">
      {questions.map((q, i) => {
        const done = isComplete(q, answers[q.id]);
        const pts = results?.[q.id];
        const here = i === current;
        return (
          <button key={q.id} role="tab" aria-selected={here} aria-label={`Question ${i + 1}${done ? ', answered' : ''}`} onClick={() => onJump(i)}
            className="group flex h-11 flex-1 items-center">
            <span className={cx('block w-full rounded-full transition-all duration-300',
              here ? 'h-1.5' : 'h-[3px] group-hover:h-1',
              results ? (pts === q.weight ? 'bg-ok' : (pts ?? 0) > 0 ? 'bg-warn' : 'bg-surface3') : done ? 'bg-accent' : here ? 'bg-ink/80' : 'bg-surface3')} />
          </button>
        );
      })}
    </div>
  );
}

function ResultLine({ q, mine, key_, pts }: { q: Question; mine?: AnswerValue; key_?: AnswerValue; pts: number }) {
  return (
    <div className={cx('mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4', pts === q.weight ? 'border-ok/40 bg-ok/[.07]' : pts > 0 ? 'border-warn/40 bg-warn/[.06]' : 'border-line bg-surface')}>
      <span className="text-sm"><span className="text-muted">You: </span><span className="font-semibold">{formatValue(q, mine)}</span></span>
      <span className="text-sm"><span className="text-muted">Result: </span><span className="font-semibold">{formatValue(q, key_)}</span></span>
      <span className="num ml-auto font-display text-2xl font-bold">{pts}<span className="text-base text-muted"> / {q.weight}</span></span>
    </div>
  );
}

/** After the last question: what's left to do, and the player's Prediction Pass. */
function PassView({ race, answers, onEdit, locked }: { race: RaceDetail; answers: Record<string, AnswerValue>; onEdit: (i: number) => void; locked: boolean }) {
  const { user } = useAuth();
  const player = user?.display_name ?? user?.email.split('@')[0] ?? 'You';
  const missing = race.questions.findIndex((q) => !isComplete(q, answers[q.id]));
  const left = race.questions.filter((q) => !isComplete(q, answers[q.id])).length;
  const res = race.results;
  const title = res ? 'Your result' : locked ? 'Picks locked' : left ? `${left} still to answer` : 'Predictions in';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:gap-10">
      <div className="min-w-0 md:sticky md:top-28">
        <h2 className="font-display text-[40px] font-black uppercase leading-[0.9] sm:text-5xl">{title}</h2>
        <p className="mt-3 max-w-md text-[17px] leading-relaxed">
          {res ? <>You scored <b className="num">{res.points ?? 0}</b> of {res.max_points} points{res.rank ? <>, {ordinal(res.rank)} place</> : ''}. Each line on your pass shows what it earned.</>
            : locked ? 'The quiz is locked. This pass holds your final predictions.'
            : <>Everything is saved, and there's nothing to submit. Tap any line on your pass to change it until lights out, <span className="font-semibold">{fmtDateTime(race.quiz_closes_at)}</span>.</>}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          {!locked && missing !== -1 && <Button iconRight={ArrowRight} onClick={() => onEdit(missing)} className="max-sm:w-full">Answer question {missing + 1}</Button>}
          <Link to={`/races/${race.id}`} className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-muted hover:text-ink"><Flag className="h-4 w-4" aria-hidden />Race hub</Link>
          <Link to="/standings" className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-muted hover:text-ink"><Trophy className="h-4 w-4" aria-hidden />Leaderboard</Link>
        </div>
      </div>
      <PredictionPass race={race} answers={answers} player={player} editable={!locked} onEdit={onEdit} />
    </div>
  );
}

function Arena({ race }: { race: RaceDetail }) {
  const [params, setParams] = useSearchParams();
  const { answers, setAnswer, state, message, fieldErrors, savedAt, retry } = useAutosave(race.id, race.my_answers);
  const n = race.questions.length;
  const raw = params.get('q');
  const index = raw === 'done' ? n : Math.min(Math.max(0, Number(raw ?? 0) || 0), n);
  const go = (i: number) => setParams(i >= n ? { q: 'done' } : { q: String(i) }, { replace: true });

  const results = race.results;
  const locked = race.phase !== 'open' || state === 'locked';
  const upcoming = race.phase === 'upcoming';
  const answered = race.questions.filter((q) => isComplete(q, answers[q.id])).length;
  const total = useMemo(() => maxPoints(race.questions), [race.questions]);
  const q = race.questions[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' && index < n) go(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // a new question starts at the top of the page, not wherever the last one was scrolled to
  useEffect(() => { window.scrollTo({ top: 0 }); }, [index]);

  // Opened without a question picked: show where the race is first, then start
  // at the first unanswered question.
  if (raw === null && !results && (race.phase === 'open' || upcoming)) {
    const next = race.questions.findIndex((qq) => !isComplete(qq, answers[qq.id]));
    return <RaceIntro race={race} answered={answered} onStart={() => go(next === -1 ? n : next)} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
      <div className="min-w-0">
        <header className="mb-6">
          <div className="-mt-2 flex items-center justify-between gap-3">
            <Link to={`/races/${race.id}`} className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm text-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" aria-hidden />Round {race.round}
            </Link>
            {race.phase === 'open' && (
              <span className="flex items-center gap-1.5 text-sm text-muted lg:hidden">
                <Timer className="h-4 w-4" aria-hidden />Locks in <Countdown to={race.quiz_closes_at} serverTime={race.server_time} compact />
              </span>
            )}
          </div>
          <h1 className="font-display text-[32px] font-black uppercase leading-[0.92] sm:text-[44px]">{race.name}</h1>
          <div className="mt-3 flex min-h-[28px] items-center justify-between gap-3">
            {locked ? <span /> : <SaveIndicator state={state} savedAt={savedAt} message={message} onRetry={retry} />}
            <span className="num font-display text-lg font-bold">{index < n ? <>Q{index + 1}<span className="text-faint"> of {n}</span></> : <span className="text-faint">{answered} of {n} answered</span>}</span>
          </div>
          <div className="mt-3"><Segments questions={race.questions} answers={answers} current={index} onJump={go} results={results?.points_by_question} /></div>
        </header>

        {upcoming && <Banner icon={Lock} tone="grey">This quiz opens {fmtDateTime(race.quiz_opens_at)}. Here's a preview of the questions.</Banner>}
        {race.phase === 'closed' && <Banner icon={Lock} tone="amber">Locked at lights out. Results are published shortly after the race.</Banner>}
        {state === 'locked' && race.phase === 'open' && <Banner icon={Lock} tone="amber">{message}</Banner>}
        {results && index < n && <Banner icon={Trophy} tone="green">Results are in: <b className="num">{results.points ?? 0}</b> of {results.max_points} points{results.rank ? `, ${ordinal(results.rank)} place` : ''}.</Banner>}

        {index >= n ? (
          <PassView race={race} answers={answers} onEdit={go} locked={locked} />
        ) : (
          // on phones the question sits straight on the page; from tablet up it gets its own sheet
          <article key={q.id} className="animate-rise md:rounded-xl md:border md:border-line md:bg-surface/40 md:p-8" aria-labelledby={`q-${q.id}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="sector">{TYPE_LABEL[q.type]}</span>
              <span className="num rounded-sm bg-accent/15 px-1.5 py-0.5 font-display text-[13px] font-bold uppercase tracking-wider text-[#FF5A52]">+{q.weight} pts</span>
              {penaltyLabel(q) && <span className="num rounded-sm border border-line px-1.5 py-0.5 font-display text-[13px] font-bold uppercase tracking-wider text-muted">{penaltyLabel(q)} if wrong</span>}
            </div>
            <h2 id={`q-${q.id}`} className="max-w-3xl text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[34px]">{q.prompt}</h2>
            {describe(q) && <p className="mt-2 max-w-2xl text-[15px] text-muted">{describe(q)}</p>}
            <div className="mt-6">
              <QuestionRenderer q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} disabled={locked || upcoming} keyValue={results?.answer_key[q.id]} />
            </div>
            {fieldErrors[q.id] && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-accent-hi"><AlertTriangle className="h-4 w-4" />{fieldErrors[q.id]}</p>}
            {results && <ResultLine q={q} mine={answers[q.id]} key_={results.answer_key[q.id]} pts={results.points_by_question[q.id] ?? 0} />}
          </article>
        )}

        {/* controls: inline from tablet up, pinned above the tab bar on phones */}
        {index < n && (
          <div className="sticky bottom-[var(--tabbar)] z-30 -mx-4 mt-6 flex items-center gap-3 border-t border-line bg-bg px-4 py-3 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
            <Button variant="secondary" icon={ArrowLeft} disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous question" className="w-12 px-0 sm:w-auto sm:px-5"><span className="hidden sm:inline">Previous</span></Button>
            <span className="min-w-0 flex-1 truncate text-center text-sm text-muted md:text-left">
              {isComplete(q, answers[q.id]) ? <span className="inline-flex items-center gap-1.5 text-ok"><Check className="h-4 w-4" aria-hidden />Answered</span> : locked || upcoming ? '' : 'Pick your answer'}
            </span>
            <Button iconRight={ArrowRight} onClick={() => go(index + 1)}>{index === n - 1 ? 'Your pass' : 'Next'}</Button>
          </div>
        )}
      </div>

      {/* sidebar: laptops only; on phones the header carries the countdown */}
      <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
        <div className="rounded-xl border border-line bg-surface p-5">
          {racePin(race) && <LazyGlobe target={racePin(race)} className="mx-auto mb-5 aspect-square w-full max-w-[220px]" />}
          <div className="flex items-center justify-between gap-2"><p className="sector">Grand Prix</p><RaceStatusBadge phase={race.phase} /></div>
          <p className="mt-2 font-display text-xl font-bold uppercase leading-tight">{race.circuit}</p>
          {race.phase === 'open' && (<div className="mt-4"><p className="mb-1 text-sm text-muted">Locks at lights out</p><span className="text-2xl"><Countdown to={race.quiz_closes_at} serverTime={race.server_time} compact /></span></div>)}
          <dl className="mt-5 grid grid-cols-3 border-t border-line pt-4 text-center">
            <div><dt className="text-xs text-muted">Answered</dt><dd className="num font-display text-xl font-bold">{answered}/{n}</dd></div>
            <div><dt className="text-xs text-muted">Points</dt><dd className="num font-display text-xl font-bold">{total}</dd></div>
            <div><dt className="flex items-center justify-center gap-1 text-xs text-muted"><Users className="h-3 w-3" aria-hidden />Players</dt><dd className="num font-display text-xl font-bold">{race.entries}</dd></div>
          </dl>
        </div>
        <ol className="rounded-xl border border-line bg-surface p-2">
          {race.questions.map((qq, i) => {
            const done = isComplete(qq, answers[qq.id]);
            return (
              <li key={qq.id}>
                <button onClick={() => go(i)} className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-surface2', i === index && 'bg-surface2')}>
                  <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', done ? 'bg-accent text-white' : 'bg-surface3 text-muted')}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className={cx('truncate', i === index ? 'text-ink' : 'text-muted')}>{qq.prompt}</span>
                </button>
              </li>
            );
          })}
          <li><button onClick={() => go(n)} className={cx('mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface2', index === n && 'bg-surface2')}><Flag className="h-4 w-4 text-accent-hi" />Your Prediction Pass</button></li>
        </ol>
      </aside>
    </div>
  );
}

function Banner({ icon: Icon, tone, children }: { icon: typeof Lock; tone: 'grey' | 'amber' | 'green'; children: ReactNode }) {
  const t = tone === 'amber' ? 'border-warn/30 bg-warn/[.07] text-warn' : tone === 'green' ? 'border-ok/30 bg-ok/[.07] text-ok' : 'border-line bg-surface text-muted';
  return <div role="status" className={cx('mb-5 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm', t)}><Icon className="h-4 w-4 shrink-0" aria-hidden /><span>{children}</span></div>;
}

export default function QuizArenaPage() {
  const id = Number(useParams().id);
  const race = useRace(id);
  if (race.isPending) return <div className="grid gap-6 lg:grid-cols-[1fr_300px]"><Skeleton className="h-[520px]" /><Skeleton className="hidden h-64 lg:block" /></div>;
  if (race.isError) return <ErrorState error={race.error} onRetry={() => race.refetch()} />;
  if (!race.data.questions.length) return <EmptyState icon={Flag} title="No questions yet" body="The admin hasn't added questions to this race." />;
  return <Arena race={race.data} />;
}
