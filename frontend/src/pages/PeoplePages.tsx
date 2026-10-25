import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Crown, Flag, LogOut, Medal, Radio, Sparkles, Target, Trophy } from 'lucide-react';
import { auth } from '../api/endpoints';
import { LeaderboardTable, rankMovement, TopThree } from '../components/leaderboard';
import { Avatar, Button, EmptyState, ErrorState, SectionTitle, Skeleton, cx, useToast } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useRaceLeaderboard, useRaces, useStandings } from '../hooks/queries';
import { ordinal } from '../utils/format';
import { LiveBoard } from './RacePages';

// ---------- Leaderboard ----------
export function LeaderboardPage() {
  const { user } = useAuth();
  const s = useStandings();
  const races = useRaces();
  // the latest scored round of this season: what "after round N" and the +/− column refer to
  const scored = (races.data ?? []).filter((r) => r.phase === 'results' && r.season === s.data?.season);
  const latest = scored.reduce<(typeof scored)[number] | undefined>((a, r) => (!a || r.round > a.round ? r : a), undefined);
  const lastRound = useRaceLeaderboard(latest?.id ?? NaN, !!latest && scored.length > 1);
  // a race that locked in the last 12 hours and isn't published yet: its provisional standings go live at the top
  // (an old quiz left unscored never takes over)
  const live = (races.data ?? [])
    .filter((r) => r.phase === 'closed' && Date.now() - new Date(r.quiz_closes_at).getTime() < 12 * 3600_000)
    .sort((a, b) => b.quiz_closes_at.localeCompare(a.quiz_closes_at))[0];
  const movement = useMemo(
    () => (s.data && lastRound.data ? rankMovement(s.data.rows, lastRound.data.rows) : undefined),
    [s.data, lastRound.data],
  );

  if (s.isPending) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
  if (s.isError) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  const rows = s.data.rows;
  const leaders = rows.filter((r) => r.rank === 1);
  const next = rows.find((r) => r.rank > 1);
  const me = rows.find((r) => r.user_id === user?.id);
  const lead = rows[0]?.points ?? 0;

  return (
    <div className="space-y-10">
    {live && (
      <section className="rounded-[24px] border border-ok/30 bg-surface p-5 sm:p-7" aria-label="Live standings">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="sector flex items-center gap-2 text-ok"><Radio className="h-4 w-4" aria-hidden />Live now · Round {live.round}</p>
            <h2 className="mt-1 font-display text-3xl font-black uppercase leading-none sm:text-4xl">{live.name}</h2>
          </div>
          <Link to={`/races/${live.id}?tab=leaderboard`} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">Race page<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        <LiveBoard raceId={live.id} initialView="season" />
      </section>
    )}
    <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12">
      <div className="space-y-6 lg:sticky lg:top-24">
        <header>
          <p className="sector">{s.data.season} Championship{latest && ` · after round ${latest.round}`}</p>
          <h1 className="mt-1 font-display text-[44px] font-black uppercase leading-[0.9] sm:text-6xl">Standings</h1>
        </header>

        {rows.length > 0 && (
          // one strip, hairline dividers: who leads, by how much, and where you are
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <div className="bg-bg p-3.5">
              <dt className="text-xs text-muted">{leaders.length > 1 ? 'Joint leaders' : 'Leader'}</dt>
              <dd className="mt-1 truncate font-semibold">{leaders.length > 1 ? `${leaders[0].name} +${leaders.length - 1}` : leaders[0].name}</dd>
            </div>
            <div className="bg-bg p-3.5">
              <dt className="text-xs text-muted">Points</dt>
              <dd className="num mt-0.5 font-display text-2xl font-bold leading-none">{lead}</dd>
            </div>
            <div className="bg-bg p-3.5">
              <dt className="text-xs text-muted">Gap to P2</dt>
              <dd className="num mt-0.5 font-display text-2xl font-bold leading-none">{leaders.length > 1 || !next ? 'Level' : `+${lead - next.points}`}</dd>
            </div>
            <div className={cx('p-3.5', me ? 'bg-accent/[.08]' : 'bg-bg')}>
              <dt className="text-xs text-muted">You</dt>
              <dd className="num mt-0.5 font-display text-2xl font-bold leading-none">
                {me ? <>P{me.rank}<span className="ml-1.5 text-sm font-semibold text-muted">{me.points} pts</span></> : <span className="text-base font-semibold text-muted">Not ranked yet</span>}
              </dd>
            </div>
          </dl>
        )}

        {rows.length > 0 && <TopThree rows={rows} meId={user?.id} movement={movement} round={latest?.round} />}
      </div>

      <div className="mt-8 lg:mt-0">
        {rows.length === 0
          ? <EmptyState icon={Trophy} title="No standings yet" body="The table fills in after the first race of the season is scored." />
          : <LeaderboardTable rows={rows} meId={user?.id} movement={movement} round={latest?.round} />}
      </div>
    </div>
    </div>
  );
}

// ---------- Profile ----------
const PLANNED_BADGES = [
  { icon: Flag, name: 'First quiz completed', body: 'Answer every question in a race quiz.' },
  { icon: Sparkles, name: 'Perfect score', body: 'Full points in a single race.' },
  { icon: Medal, name: 'Podium predictor', body: 'Call the exact podium in order.' },
  { icon: Target, name: 'Race weekend regular', body: 'Play five race weekends in a row.' },
  { icon: Crown, name: 'Championship contender', body: 'Sit in the top three after any round.' },
];

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const races = useRaces();
  const s = useStandings();
  const [name, setName] = useState(user?.display_name ?? '');
  useEffect(() => { setName(user?.display_name ?? ''); }, [user?.display_name]);

  const save = useMutation({
    mutationFn: (n: string) => auth.updateMe(n),
    onSuccess: (u) => { qc.setQueryData(['me'], u); qc.invalidateQueries({ queryKey: ['standings'] }); toast('ok', 'Name saved'); if (welcome) nav('/'); },
    onError: (e) => toast('error', (e as Error).message),
  });
  if (!user) return null;
  const row = s.data?.rows.find((r) => r.user_id === user.id);
  const history = (races.data ?? []).filter((r) => r.phase === 'results').sort((a, b) => b.round - a.round);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(name); };

  return (
    <div className="space-y-8">
      {welcome && (
        <div className="panel animate-rise border-accent/40 p-5 sm:p-6">
          <p className="font-display text-3xl font-bold uppercase">Welcome to the grid</p>
          <p className="mt-1 text-muted">Pick the name other players see on the leaderboard.</p>
        </div>
      )}
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={user.display_name ?? user.email} me size={76} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-4xl font-black uppercase leading-none sm:text-5xl">{user.display_name ?? 'No name yet'}</h1>
            <p className="mt-1 truncate text-muted">{user.email}{user.is_admin && ' · Admin'}</p>
          </div>
          {row && <div className="text-right"><p className="num font-display text-5xl font-bold leading-none">{ordinal(row.rank)}</p><p className="text-sm text-muted">{row.points} pts</p></div>}
        </div>
        {row && (
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Points', row.points], ['Races', row.races], ['Wins', row.wins], ['Podiums', row.podiums]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface2 p-3"><dt className="text-xs text-muted">{k}</dt><dd className="num font-display text-3xl font-bold">{v}</dd></div>
            ))}
          </dl>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle kicker="History" title="Race by race" />
          {races.isPending ? <Skeleton className="h-60" /> : history.length === 0 ? <EmptyState icon={Flag} title="No scored races yet" body="Your results appear here race by race." /> : (
            <ol className="space-y-2">
              {history.map((r) => (
                <li key={r.id}><Link to={`/races/${r.id}?tab=results`} className="panel-2 flex items-center gap-4 p-4 transition hover:bg-surface3">
                  <span className="num w-10 font-display text-2xl font-black text-transparent [-webkit-text-stroke:1.2px_#5E6672]">{r.round}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.name}</span><span className="text-sm text-muted">{r.my_rank ? `${ordinal(r.my_rank)} place` : 'Not entered'}</span></span>
                  <span className="num font-display text-2xl font-bold">{r.my_points ?? '–'}</span>
                </Link></li>
              ))}
            </ol>
          )}
        </section>
        <div className="space-y-6">
          <section className="panel p-5">
            <SectionTitle kicker="Settings" title="Display name" />
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} minLength={2} required placeholder="e.g. Ansh T."
                className="h-11 flex-1 rounded-xl border border-line bg-surface2 px-4 focus:border-faint focus:outline-none" aria-label="Display name" />
              <Button type="submit" loading={save.isPending}>Save</Button>
            </form>
            <Button variant="ghost" icon={LogOut} className="mt-4" onClick={() => { signOut(); nav('/login'); }}>Sign out</Button>
          </section>
          <section className="panel p-5">
            <SectionTitle kicker="Achievements" title="Badges" />
            <p className="mb-4 text-sm text-muted">Badges aren't switched on yet. These are the ones planned; none is awarded until the league server tracks them.</p>
            <ul className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {PLANNED_BADGES.map((b) => (
                <li key={b.name} className="flex items-start gap-3 rounded-xl border border-dashed border-line p-3 opacity-70">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface2 text-faint"><b.icon className="h-5 w-5" aria-hidden /></span>
                  <span><span className="block text-sm font-semibold">{b.name}</span><span className="block text-xs text-muted">{b.body}</span></span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return <EmptyState icon={Flag} title="Off track" body="That page doesn't exist." action={<Link to="/"><Button>Back to home</Button></Link>} />;
}
