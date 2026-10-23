import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, CalendarClock, Flag, ListChecks, Lock, MapPin, Radio, Trophy, Users } from 'lucide-react';
import { ApiError } from '../api/client';
import type { RaceDetail } from '../api/types';
import { formatValue } from '../components/quiz';
import { Countdown, GrandPrixCard, RaceStatusBadge, TrackOutline } from '../components/race';
import { Avatar, Badge, Button, EmptyState, ErrorState, SectionTitle, Skeleton, cx } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useLiveLeaderboard, useRace, useRaceLeaderboard, useRaces } from '../hooks/queries';
import { isComplete, maxPoints } from '../utils/answers';
import { fmtDate, fmtDateTime, fmtTime, ordinal, two } from '../utils/format';

// ---------- Race Weekend: every race of the season ----------
export function RacesPage() {
  const races = useRaces();
  if (races.isPending) return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (races.isError) return <ErrorState error={races.error} onRetry={() => races.refetch()} />;
  const groups: [string, string, typeof races.data][] = [
    ['Now', 'Open and locked', races.data.filter((r) => r.phase === 'open' || r.phase === 'closed')],
    ['Next', 'Upcoming', races.data.filter((r) => r.phase === 'upcoming').sort((a, b) => a.round - b.round)],
    ['Done', 'Completed', races.data.filter((r) => r.phase === 'results')],
  ];
  return (
    <div className="space-y-10">
      <header><p className="sector">Season {races.data[0]?.season ?? ''}</p><h1 className="font-display text-5xl font-black uppercase leading-none">Race weekends</h1><div className="stripe mt-3" /></header>
      {races.data.length === 0 && <EmptyState icon={Flag} title="No races published yet" />}
      {groups.map(([k, title, list]) => list.length > 0 && (
        <section key={k}><SectionTitle kicker={k} title={title} /><div className="grid gap-2.5 md:grid-cols-2">{list.map((r) => <GrandPrixCard key={r.id} race={r} />)}</div></section>
      ))}
    </div>
  );
}

// ---------- Race Hub: one Grand Prix ----------
const TABS = [['overview', 'Overview'], ['predictions', 'My predictions'], ['results', 'Results'], ['leaderboard', 'Leaderboard']] as const;

function Overview({ race }: { race: RaceDetail }) {
  const answered = race.questions.filter((q) => isComplete(q, race.my_answers[q.id])).length;
  const cta = race.phase === 'open' ? (answered === 0 ? 'Start quiz' : answered < race.questions.length ? 'Continue quiz' : 'Review answers') : race.phase === 'upcoming' ? 'Preview questions' : 'View my answers';
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="panel p-6">
        <SectionTitle kicker="Prediction quiz" title={race.phase === 'open' ? 'Predictions open' : race.phase === 'upcoming' ? 'Opens soon' : race.phase === 'closed' ? 'Locked' : 'Final'} />
        {race.phase === 'open' && <><p className="mb-3 text-sm text-muted">Locks at lights out</p><Countdown to={race.quiz_closes_at} serverTime={race.server_time} /></>}
        {race.phase === 'upcoming' && <><p className="mb-3 text-sm text-muted">Opens</p><Countdown to={race.quiz_opens_at} serverTime={race.server_time} /></>}
        {race.phase === 'closed' && <p className="text-muted">Predictions locked {fmtDateTime(race.quiz_closes_at)}. Results are published shortly after the chequered flag.</p>}
        {race.phase === 'results' && race.results && <p className="text-muted">You scored <b className="num text-ink">{race.results.points ?? 0}</b> of {race.results.max_points}{race.results.rank ? `, finishing ${ordinal(race.results.rank)}` : ''}.</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/quiz/${race.id}`}><Button size="lg" iconRight={ArrowRight}>{cta}</Button></Link>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {[
          [ListChecks, 'Questions', `${race.questions.length}`],
          [Trophy, 'Points available', `${maxPoints(race.questions)}`],
          [Users, 'Players in', `${race.entries}`],
          [CalendarClock, 'You answered', `${answered}/${race.questions.length}`],
        ].map(([Icon, k, v]) => {
          const I = Icon as typeof Users;
          return <div key={k as string} className="panel p-4"><dt className="flex items-center gap-1.5 text-sm text-muted"><I className="h-4 w-4" aria-hidden />{k as string}</dt><dd className="num mt-2 font-display text-4xl font-bold">{v as string}</dd></div>;
        })}
        <div className="panel col-span-2 p-4 text-sm">
          <p className="flex justify-between gap-3"><span className="text-muted">Quiz opens</span><span>{fmtDateTime(race.quiz_opens_at)}</span></p>
          <p className="mt-2 flex justify-between gap-3"><span className="text-muted">Locks</span><span>{fmtDateTime(race.quiz_closes_at)}</span></p>
          <p className="mt-3 text-xs text-faint">Session times beyond the quiz window aren't available from the league server yet.</p>
        </div>
      </dl>
    </div>
  );
}

function Predictions({ race }: { race: RaceDetail }) {
  const any = Object.keys(race.my_answers).length > 0;
  if (!any) return <EmptyState icon={ListChecks} title="No predictions yet" body={race.phase === 'open' ? 'Your answers save as you tap. Start whenever you like.' : 'You didn\'t enter this race.'}
    action={race.phase === 'open' ? <Link to={`/quiz/${race.id}`}><Button>Start quiz</Button></Link> : undefined} />;
  return (
    <ol className="space-y-2">
      {race.questions.map((q, i) => (
        <li key={q.id} className="panel-2 flex items-center gap-4 p-4">
          <span className="num w-8 font-display text-lg font-bold text-muted">{two(i + 1)}</span>
          <span className="min-w-0 flex-1"><span className="block text-sm text-muted">{q.prompt}</span><span className="block font-semibold">{formatValue(q, race.my_answers[q.id])}</span></span>
          {race.phase === 'open' && <Link to={`/quiz/${race.id}?q=${i}`} className="text-sm font-semibold text-muted hover:text-ink">Change</Link>}
        </li>
      ))}
    </ol>
  );
}

function Results({ race }: { race: RaceDetail }) {
  const r = race.results;
  if (!r) return <EmptyState icon={Lock} title="Results aren't out yet" body="They're published after the race is scored, usually during the podium ceremony." />;
  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end justify-between gap-6 p-6">
        <div><p className="sector">Your score</p><p className="num font-display text-7xl font-bold leading-none">{r.points ?? 0}<span className="ml-2 text-2xl text-muted">/ {r.max_points}</span></p></div>
        {r.rank && <div className="text-right"><p className="sector">Finish</p><p className="num font-display text-5xl font-bold leading-none">{ordinal(r.rank)}</p><p className="text-sm text-muted">of {race.entries}</p></div>}
      </div>
      <ol className="space-y-2">
        {race.questions.map((q) => {
          const pts = r.points_by_question[q.id] ?? 0;
          return (
            <li key={q.id} className="panel-2 grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4">
              <span className={cx('h-3 w-3 rounded-full', pts === q.weight ? 'bg-ok' : pts ? 'bg-warn' : 'bg-surface3')} aria-label={pts === q.weight ? 'Correct' : pts ? 'Partly correct' : 'Not correct'} />
              <span className="min-w-0">
                <span className="block font-semibold">{q.prompt}</span>
                <span className="mt-1 flex flex-wrap gap-x-5 text-sm text-muted"><span>You: <b className="font-medium text-ink">{formatValue(q, race.my_answers[q.id])}</b></span><span>Result: <b className="font-medium text-ink">{formatValue(q, r.answer_key[q.id])}</b></span></span>
              </span>
              <span className="num font-display text-2xl font-bold">{pts}<span className="text-sm text-muted">/{q.weight}</span></span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Between the lock and published results: provisional points from the results known so far, re-read every 20 s.
function LiveBoard({ race }: { race: RaceDetail }) {
  const { user } = useAuth();
  const [view, setView] = useState<'quiz' | 'season'>('quiz');
  const live = useLiveLeaderboard(race.id);
  if (live.isPending) return <Skeleton className="h-72" />;
  if (live.isError) return <ErrorState error={live.error} onRetry={() => live.refetch()} />;
  const l = live.data;
  const final = l.results_in === l.questions && l.live_results === 0;
  const me = (id: number) => id === user?.id;
  const row = 'grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={final ? 'grey' : 'green'} dot={!final}><Radio className="h-3.5 w-3.5" aria-hidden />{final ? 'Provisional · awaiting publish' : 'Live · provisional'}</Badge>
        <span className="text-sm text-muted">{l.results_in} of {l.questions} results in{l.live_results ? ` (${l.live_results} still live)` : ''}{l.updated_at ? ` · updated ${fmtTime(l.updated_at)}` : ''}</span>
      </div>
      <div className="flex gap-1" role="tablist" aria-label="Live standings">
        {([['quiz', 'This quiz'], ['season', 'Season']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold', view === k ? 'bg-ink text-bg' : 'text-muted hover:bg-surface')}>{label}</button>
        ))}
      </div>
      {l.rows.length === 0 ? <EmptyState icon={Trophy} title="Nobody entered this quiz" body="Live standings appear for players who made predictions." /> : view === 'quiz' ? (
        <ol className="space-y-1">
          {l.rows.map((r) => (
            <li key={r.user_id} className={cx(row, me(r.user_id) ? 'bg-accent/[.09] ring-1 ring-accent/40' : 'odd:bg-surface/60')}>
              <span className="num font-display text-xl font-bold text-muted">{r.rank}</span>
              <span className="flex min-w-0 items-center gap-3"><Avatar name={r.name} me={me(r.user_id)} size={32} /><span className="truncate font-semibold">{r.name}</span></span>
              <span className="num font-display text-xl font-bold">{r.points}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="space-y-1">
          {l.season_rows.map((r) => {
            const moved = r.prev_rank === null ? 0 : r.prev_rank - r.rank;
            return (
              <li key={r.user_id} className={cx(row, me(r.user_id) ? 'bg-accent/[.09] ring-1 ring-accent/40' : 'odd:bg-surface/60')}>
                <span className="num font-display text-xl font-bold text-muted">{r.rank}</span>
                <span className="flex min-w-0 items-center gap-3"><Avatar name={r.name} me={me(r.user_id)} size={32} /><span className="truncate font-semibold">{r.name}</span>
                  {moved > 0 && <span className="flex items-center text-xs font-bold text-ok"><ArrowUp className="h-3.5 w-3.5" aria-hidden />{moved}</span>}
                  {moved < 0 && <span className="flex items-center text-xs font-bold text-accent-hi"><ArrowDown className="h-3.5 w-3.5" aria-hidden />{-moved}</span>}
                </span>
                <span className="text-right"><span className="num font-display text-xl font-bold">{r.points}</span>{r.race_points !== null && <span className="num block text-xs text-muted">{r.race_points >= 0 ? '+' : ''}{r.race_points} live</span>}</span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-faint">Provisional: points use the results known so far and can change until results are published.</p>
    </div>
  );
}

function RaceBoard({ race }: { race: RaceDetail }) {
  const { user } = useAuth();
  if (race.phase === 'closed') return <LiveBoard race={race} />;
  return <PublishedBoard race={race} user={user} />;
}

function PublishedBoard({ race, user }: { race: RaceDetail; user: ReturnType<typeof useAuth>['user'] }) {
  const lb = useRaceLeaderboard(race.id, race.phase === 'results' || !!user?.is_admin);
  if (race.phase !== 'results' && !user?.is_admin) return <EmptyState icon={Trophy} title="No race leaderboard yet" body="It appears once results are published." />;
  if (lb.isPending) return <Skeleton className="h-72" />;
  if (lb.isError) return (lb.error as ApiError).status === 403 ? <EmptyState icon={Trophy} title="No race leaderboard yet" body="It appears once results are published." /> : <ErrorState error={lb.error} onRetry={() => lb.refetch()} />;
  return (
    <ol className="space-y-1">
      {!lb.data.published && <Badge tone="amber" className="mb-2">Admin preview · not published</Badge>}
      {lb.data.rows.map((r) => (
        <li key={r.user_id} className={cx('grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5', r.user_id === user?.id ? 'bg-accent/[.09] ring-1 ring-accent/40' : 'odd:bg-surface/60')}>
          <span className="num font-display text-xl font-bold text-muted">{r.rank}</span>
          <span className="flex min-w-0 items-center gap-3"><Avatar name={r.name} me={r.user_id === user?.id} size={32} /><span className="truncate font-semibold">{r.name}</span></span>
          <span className="num font-display text-xl font-bold">{r.points}</span>
        </li>
      ))}
    </ol>
  );
}

export function RaceHubPage() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'overview') as (typeof TABS)[number][0];
  const race = useRace(id);
  if (race.isPending) return <div className="space-y-4"><Skeleton className="h-52" /><Skeleton className="h-72" /></div>;
  if (race.isError) return <ErrorState error={race.error} onRetry={() => race.refetch()} />;
  const r = race.data;
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[24px] border border-line bg-surface p-6 sm:p-8">
        <TrackOutline className="pointer-events-none absolute -right-8 -top-4 w-[340px] text-white/[.06] sm:w-[460px]" />
        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-3"><span className="sector text-ink/80">Round {r.round} · {r.season}</span><RaceStatusBadge phase={r.phase} /></div>
          <h1 className="font-display text-5xl font-black uppercase leading-[0.92] sm:text-6xl">{r.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted"><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{r.circuit}, {r.country}</span><span>Quiz {fmtDate(r.quiz_opens_at)} – {fmtDate(r.quiz_closes_at)}</span></p>
        </div>
      </header>
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Race sections">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k }, { replace: true })}
            className={cx('shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition', tab === k ? 'bg-ink text-bg' : 'text-muted hover:bg-surface hover:text-ink')}>{label}</button>
        ))}
      </nav>
      <div className="animate-rise" key={tab}>
        {tab === 'overview' && <Overview race={r} />}
        {tab === 'predictions' && <Predictions race={r} />}
        {tab === 'results' && <Results race={r} />}
        {tab === 'leaderboard' && <RaceBoard race={r} />}
      </div>
    </div>
  );
}
