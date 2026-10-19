import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, ChevronRight, Trophy } from 'lucide-react';
import type { Phase, RaceSummary } from '../api/types';
import { splitMs, useCountdown } from '../hooks/useCountdown';
import { fmtDateTime, fmtDay, fmtTime, ordinal, PHASE_LABEL, relative, two } from '../utils/format';
import { trackOutline } from '../fixtures/tracks';
import { LazyCircuit, LazyGlobe, racePin, seasonMarkers } from './LazyGlobe';
import { Badge, Button, cx } from './ui';

export function RaceStatusBadge({ phase }: { phase: Phase }) {
  const tone = phase === 'open' ? 'green' : phase === 'closed' ? 'amber' : phase === 'results' ? 'white' : 'grey';
  return <Badge tone={tone} dot={phase === 'open'}>{PHASE_LABEL[phase]}</Badge>;
}

/** Decorative circuit-style line. Abstract on purpose: not any real track. */
export function TrackOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 220" fill="none" className={className} aria-hidden>
      <path d="M40 160 C40 120 70 110 100 112 L180 118 C210 120 222 98 214 76 C206 52 228 34 254 40 L330 58 C364 66 372 100 350 118 L300 158 C280 174 290 190 314 192 L340 194 C360 196 362 212 342 214 L90 214 C60 214 40 196 40 160 Z"
        stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M100 112 L112 104" stroke="#E10600" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Countdown({ to, serverTime, compact }: { to: string; serverTime?: string; compact?: boolean }) {
  const ms = useCountdown(to, serverTime) ?? 0;
  const { days, hours, minutes, seconds } = splitMs(ms);
  const urgent = ms > 0 && ms < 15 * 60_000;
  const parts = days > 0 ? [[days, 'Days'], [hours, 'Hrs'], [minutes, 'Min']] : [[hours, 'Hrs'], [minutes, 'Min'], [seconds, 'Sec']];
  if (compact) {
    return <span className={cx('num font-display font-bold', urgent && 'text-accent-hi')}>{days > 0 ? `${days}d ${two(hours)}h` : `${two(hours)}:${two(minutes)}:${two(seconds)}`}</span>;
  }
  return (
    <div className="flex items-end gap-2" role="timer" aria-label={`${days} days ${hours} hours ${minutes} minutes left`}>
      {parts.map(([v, l], i) => (
        <div key={l} className="flex items-end gap-2">
          {i > 0 && <span className="pb-6 font-display text-3xl font-bold text-faint">:</span>}
          <div className="text-center">
            <div className={cx('num min-w-[2.2ch] rounded-lg bg-black/40 px-2 font-display text-5xl font-bold leading-[1.1] ring-1 ring-white/5 sm:text-6xl', urgent && 'text-accent-hi')}>{two(v as number)}</div>
            <div className="mt-1 font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">{l}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function heroCta(r: RaceSummary) {
  if (r.phase === 'open') {
    const label = r.answered_count === 0 ? 'Start quiz' : r.answered_count < r.question_count ? `Continue quiz · ${r.answered_count}/${r.question_count}` : 'Review my answers';
    return { to: `/quiz/${r.id}`, label };
  }
  if (r.phase === 'results') return { to: `/races/${r.id}?tab=results`, label: 'See results' };
  return { to: `/races/${r.id}`, label: 'Enter race hub' };
}

/**
 * The next race, Home's hero: its circuit in 3D where we have the outline (Austin so far),
 * otherwise the globe with the circuit pinned on the season's route. Other pages keep the globe.
 */
export function RaceHero({ race, season = [] }: { race: RaceSummary; season?: RaceSummary[] }) {
  const cta = heroCta(race);
  const pin = racePin(race);
  const outline = trackOutline(race);
  const gp = /\s+grand prix$/i.test(race.name);
  return (
    <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10" aria-labelledby="hero-race">
      {outline
        ? <LazyCircuit outline={outline} label={`${race.circuit} in 3D, with the start line and Turn 1 marked; a red light runs the lap.`}
            className="aspect-[4/3] w-full sm:aspect-[16/10] lg:order-last" />
        : <LazyGlobe target={pin} markers={seasonMarkers(season)} route flyIn
            className="mx-auto aspect-square w-full max-w-[min(100%,40svh)] lg:order-last lg:max-w-[640px]" />}
      <div className="min-w-0 animate-rise">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[15px] text-muted">Round {race.round} of the {race.season} season</span>
          <RaceStatusBadge phase={race.phase} />
        </div>
        <h1 id="hero-race" className="font-display text-[clamp(3.25rem,13vw,7.5rem)] font-black uppercase leading-[0.88] tracking-tight [overflow-wrap:anywhere]">
          {gp ? race.name.replace(/\s+grand prix$/i, '') : race.name}
        </h1>
        <p className="mt-3 text-lg">{gp && 'Grand Prix · '}{race.circuit}</p>
        <div className="mt-7">
          {race.phase === 'open' && (<>
            <p className="mb-2 text-[15px] text-muted">Predictions lock in</p>
            <Countdown to={race.quiz_closes_at} />
            <p className="mt-2 text-sm text-muted">Locks {fmtDateTime(race.quiz_closes_at)}</p>
          </>)}
          {race.phase === 'upcoming' && (<>
            <p className="mb-2 text-[15px] text-muted">Quiz opens in</p>
            <Countdown to={race.quiz_opens_at} />
          </>)}
          {race.phase === 'closed' && <p className="max-w-sm text-muted">Predictions are locked. Results are published shortly after the chequered flag.</p>}
          {race.phase === 'results' && race.my_points !== null && (
            <p className="num font-display text-6xl font-bold">{race.my_points}<span className="ml-2 text-2xl text-muted">pts · {ordinal(race.my_rank ?? 0)} place</span></p>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={cta.to}><Button size="lg" iconRight={ArrowRight}>{cta.label}</Button></Link>
          <Link to="/standings"><Button size="lg" variant="secondary" icon={Trophy}>Standings</Button></Link>
        </div>
      </div>
    </section>
  );
}

export function GrandPrixCard({ race }: { race: RaceSummary }) {
  const progress = race.question_count ? race.answered_count / race.question_count : 0;
  return (
    <Link to={`/races/${race.id}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:border-faint hover:bg-surface2 sm:p-5">
      <span className="num w-14 shrink-0 font-display text-4xl font-black leading-none text-transparent [-webkit-text-stroke:1.5px_#5E6672] group-hover:[-webkit-text-stroke-color:#E10600]">
        {two(race.round)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl font-bold uppercase leading-tight">{race.name}</p>
        <p className="truncate text-sm text-muted">{race.circuit}</p>
        {/* the quiz locks at lights out, so this is the race's own start time */}
        {(race.phase === 'open' || race.phase === 'upcoming') && (
          <p className="num mt-1 flex items-center gap-1.5 text-sm">
            <CalendarClock className="h-4 w-4 shrink-0 text-muted" aria-hidden /><span className="sr-only">Lights out </span>
            <span><span className="font-semibold">{fmtDay(race.quiz_closes_at)}</span><span className="text-muted"> · </span><span className="whitespace-nowrap">{fmtTime(race.quiz_closes_at)}</span></span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RaceStatusBadge phase={race.phase} />
          {race.phase === 'upcoming' && <span className="text-xs text-muted">quiz opens {relative(race.quiz_opens_at)}</span>}
          {race.phase === 'open' && <span className="text-xs text-muted">locks {relative(race.quiz_closes_at)}</span>}
        </div>
        {race.phase === 'open' && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface3" aria-label={`${race.answered_count} of ${race.question_count} answered`}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      {race.phase === 'results' && race.my_points !== null ? (
        <div className="text-right"><p className="num font-display text-3xl font-bold leading-none">{race.my_points}</p><p className="text-xs text-muted">{ordinal(race.my_rank ?? 0)}</p></div>
      ) : <ChevronRight className="h-5 w-5 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />}
    </Link>
  );
}
