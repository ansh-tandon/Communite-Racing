import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { GrandPrixCard, RaceHero } from '../components/race';
import { EmptyState, ErrorState, SectionTitle, Skeleton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useRaces, useStandings } from '../hooks/queries';
import { featuredRace, ordinal } from '../utils/format';

export function UserStats() {
  const { user } = useAuth();
  const s = useStandings();
  if (s.isPending) return <Skeleton className="h-48" />;
  if (s.isError) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  const row = s.data.rows.find((r) => r.user_id === user?.id);
  const leader = s.data.rows[0];
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent via-accent/50 to-transparent" />
      <p className="sector">Your championship · {s.data.season}</p>
      {row ? (<>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="num font-display text-6xl font-bold leading-none">{row.points}</p>
            <p className="mt-1 text-sm text-muted">points</p>
          </div>
          <div className="text-right">
            <p className="num font-display text-4xl font-bold leading-none">{ordinal(row.rank)}</p>
            <p className="mt-1 text-sm text-muted">of {s.data.rows.length}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[['Races', row.races], ['Wins', row.wins], ['Podiums', row.podiums]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface2 py-2.5"><dt className="text-xs text-muted">{k}</dt><dd className="num font-display text-2xl font-bold">{v}</dd></div>
          ))}
        </dl>
        {leader && leader.user_id !== row.user_id && <p className="mt-4 text-sm text-muted"><span className="num font-semibold text-ink">{leader.points - row.points}</span> points behind {leader.name}.</p>}
      </>) : (
        <p className="mt-3 text-muted">You'll appear here once your first race is scored.</p>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const races = useRaces();

  if (races.isPending) return <div className="space-y-6"><Skeleton className="h-[420px] rounded-[24px]" /><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div></div>;
  if (races.isError) return <ErrorState error={races.error} onRetry={() => races.refetch()} />;

  const list = races.data;
  const hero = featuredRace(list);
  const live = list.filter((r) => (r.phase === 'open' || r.phase === 'upcoming') && r.id !== hero?.id).sort((a, b) => a.round - b.round);
  const done = list.filter((r) => r.phase === 'results').sort((a, b) => b.round - a.round).slice(0, 3);

  return (
    <div className="space-y-8">
      <p className="text-muted">Welcome back{user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}.</p>
      {hero ? <RaceHero race={hero} season={list} /> :<EmptyState icon={Flag} title="No races yet" body="The season's first quiz appears here as soon as the admin opens it." />}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <section>
            <SectionTitle kicker="Race weekends" title="Coming up" action={<Link to="/races" className="text-sm font-semibold text-muted hover:text-ink">All races</Link>} />
            {live.length ? <div className="space-y-2.5">{live.map((r) => <GrandPrixCard key={r.id} race={r} />)}</div>
              : <p className="panel p-5 text-muted">Nothing else scheduled yet. New quizzes appear here when they're published.</p>}
          </section>
          <section>
            <SectionTitle kicker="Completed" title="Recent results" />
            {done.length ? <div className="space-y-2.5">{done.map((r) => <GrandPrixCard key={r.id} race={r} />)}</div>
              : <p className="panel p-5 text-muted">Results appear here after each race is scored.</p>}
          </section>
        </div>
        <aside className="space-y-6">
          <UserStats />
        </aside>
      </div>
    </div>
  );
}
