import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Crosshair, Search } from 'lucide-react';
import type { LeaderRow, SeasonRow } from '../api/types';
import { ordinal } from '../utils/format';
import { Avatar, Button, cx } from './ui';

const PAGE = 20;
// restrained medal tones: P1 gold, P2 silver, P3 bronze (by rank, so a tie for P2 is two silvers)
const MEDAL = ['#D9B54A', '#B8BEC7', '#B9835A'];
const medal = (rank: number) => (rank <= 3 ? MEDAL[rank - 1] : undefined);

export type Movement = number | 'new';

/**
 * Places gained (+) or lost (−) in the latest scored round, from real data: the standings without
 * that round's points, ranked the way the backend ranks (by points; ties share a rank, 1, 2, 2, 4),
 * compared with today's ranks. A player whose only race is that round is 'new'.
 */
export function rankMovement(rows: SeasonRow[], lastRound: LeaderRow[]): Map<number, Movement> {
  const last = new Map(lastRound.map((r) => [r.user_id, r.points]));
  const before = rows
    .filter((r) => r.races - (last.has(r.user_id) ? 1 : 0) > 0)
    .map((r) => ({ id: r.user_id, points: r.points - (last.get(r.user_id) ?? 0) }))
    .sort((a, b) => b.points - a.points);
  const prevRank = new Map<number, number>();
  before.forEach((r, i) => prevRank.set(r.id, i > 0 && r.points === before[i - 1].points ? prevRank.get(before[i - 1].id)! : i + 1));
  return new Map(rows.map((r) => [r.user_id, prevRank.has(r.user_id) ? prevRank.get(r.user_id)! - r.rank : 'new']));
}

/** A tied rank reads "=2", like a timing sheet. */
const tied = (rows: SeasonRow[], i: number) => rows[i - 1]?.rank === rows[i].rank || rows[i + 1]?.rank === rows[i].rank;

function Move({ m, round }: { m: Movement | undefined; round?: number }) {
  if (m === undefined) return <span />;
  const since = round ? ` since round ${round}` : '';
  if (m === 'new') return <span className="font-display text-[11px] font-bold uppercase tracking-wider text-muted" aria-label={`New${since}`}>New</span>;
  if (m === 0) return <span className="text-faint" aria-label={`No change${since}`}>–</span>;
  const up = m > 0;
  return (
    <span className={cx('num inline-flex items-center gap-0.5 font-display text-sm font-bold', up ? 'text-ok' : 'text-muted')}
      aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(m)} ${Math.abs(m) === 1 ? 'place' : 'places'}${since}`}>
      <span aria-hidden className="text-[9px]">{up ? '▲' : '▼'}</span>{Math.abs(m)}
    </span>
  );
}

// ---------- podium ----------

const EASE = [0.22, 1, 0.36, 1] as const;
// The entrance, in seconds: P2 and P3 rise first, P1 last; everything has landed by ~0.8 s.
const RISE = 0.42;
const DELAY = { 1: 0.18, 2: 0, 3: 0.06 } as Record<number, number>;
const STEP_H = { 1: 'h-24 sm:h-28', 2: 'h-16 sm:h-[4.5rem]', 3: 'h-11 sm:h-12' } as Record<number, string>;

/** Counts up to `to` once `run` turns true (ease-out, ~0.5 s); shows `to` at once otherwise. */
function useCountUp(to: number, run: boolean, delay: number, ms = 480) {
  const [v, setV] = useState(run ? 0 : to);
  useEffect(() => {
    if (!run) { setV(to); return; }
    let raf = 0;
    let start = 0;
    const t = window.setTimeout(() => {
      const step = (now: number) => {
        start ||= now;
        const k = Math.min(1, (now - start) / ms);
        setV(Math.round(to * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay * 1000);
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [to, run, delay, ms]);
  return v;
}

function PodiumPlace({ r, place, lead, joint, me, move, round, animate, go }: {
  r: SeasonRow; place: 1 | 2 | 3; lead: number; joint: boolean; me: boolean; move?: Movement; round?: number; animate: boolean; go: boolean;
}) {
  const c = medal(r.rank) ?? MEDAL[2];
  const gold = r.rank === 1;
  const first = place === 1;
  const delay = DELAY[place];
  const shown = go || !animate;
  const points = useCountUp(r.points, animate && go, delay + 0.12);
  const gap = r.points === lead ? (r.rank === 1 ? (joint ? 'Joint leader' : 'Leader') : 'Level') : `−${lead - r.points}`;

  return (
    // DOM order is P1, P2, P3 (read in rank order); the grid shows P2 | P1 | P3
    <li className={cx('flex min-w-0 flex-col items-center text-center', first ? 'order-2' : place === 2 ? 'order-1' : 'order-3')}>
      {/* a CSS fade, not framer: Safari blinks for a frame when framer hands a finished fade back */}
      <div className={cx('flex w-full min-w-0 flex-col items-center px-1 pb-3', animate && (go ? 'animate-podin' : 'opacity-0'))}
        style={animate && go ? { animationDelay: `${delay + 0.12}s` } : undefined}>
        <span className="flex items-center gap-1.5">
          <span className="num font-display text-sm font-bold tracking-[0.14em]" style={{ color: c }}>P{r.rank}</span>
          {typeof move === 'number' && move !== 0 && (
            // only a real change since the last scored round; never on a fresh table
            <span className={cx('num inline-flex items-center gap-px font-display text-xs font-bold', move > 0 ? 'text-ok' : 'text-muted')}
              aria-label={`${move > 0 ? 'Up' : 'Down'} ${Math.abs(move)} since round ${round}`}>
              <span aria-hidden className="text-[8px]">{move > 0 ? '▲' : '▼'}</span>{Math.abs(move)}
            </span>
          )}
        </span>
        {/* the medal ring; the winner's glows once as the podium lands, then settles */}
        <motion.span className="mt-2 rounded-full"
          style={{ boxShadow: `0 0 0 2px ${c}` }}
          initial={false}
          animate={gold && animate && go ? { boxShadow: [`0 0 0 2px ${c}, 0 0 0 0 ${c}00`, `0 0 0 2px ${c}, 0 0 26px 6px ${c}70`, `0 0 0 2px ${c}, 0 0 12px 1px ${c}30`] } : undefined}
          transition={{ duration: 1, delay: delay + RISE, ease: 'easeOut' }}>
          <Avatar name={r.name} me={me} size={first ? 56 : 42} />
        </motion.span>
        <p className={cx('mt-2.5 w-full truncate font-semibold leading-tight', first ? 'text-base' : 'text-[15px]')}>{r.name}</p>
        {me && <p className="text-[11px] font-bold uppercase tracking-wider text-accent-hi">You</p>}
        <p className={cx('num mt-1 font-display font-black leading-none', first ? 'text-[44px]' : 'text-[30px]')}>
          <span aria-hidden>{points}</span><span className="sr-only">{r.points} points</span>
        </p>
        <p className="num mt-1 text-xs text-muted">{gap}</p>
      </div>

      {/* the step rises from the baseline */}
      <motion.div
        className={cx('relative w-full overflow-hidden border-t-2', STEP_H[place], first && 'z-[1] shadow-[0_-10px_30px_-18px_rgba(217,181,74,.6)]')}
        style={{ borderColor: c, background: `linear-gradient(180deg, ${c}26, ${c}08 70%, transparent)`, originY: 1 }}
        initial={animate ? { scaleY: 0 } : false}
        animate={shown ? { scaleY: 1 } : undefined}
        transition={{ duration: RISE, ease: EASE, delay }}>
        {first && (<>
          {/* a kerb along the top of P1's step: the one racing-red accent on the podium */}
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[repeating-linear-gradient(90deg,#E10600_0_10px,#F5F5F5_10px_20px)] opacity-80" />
          {/* a faint chequered corner */}
          <span aria-hidden className="absolute bottom-0 right-0 h-8 w-12 opacity-[.07] [background:repeating-conic-gradient(#fff_0_25%,transparent_0_50%)_0_0/8px_8px]" />
        </>)}
        {gold && animate && go && (
          // one gold sweep across the winner's step once it's up
          <motion.span aria-hidden className="absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-[#D9B54A]/40 to-transparent"
            initial={{ x: '-120%', opacity: 0 }} animate={{ x: '260%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.7, ease: 'easeInOut', delay: delay + RISE - 0.05 }} />
        )}
        <span aria-hidden className={cx('num absolute inset-x-0 font-display font-black leading-none', first ? 'top-3 text-3xl' : 'top-2 text-xl')}
          style={{ color: c, opacity: 0.55 }}>{r.rank}</span>
      </motion.div>
    </li>
  );
}

/**
 * The top three as one stepped podium: P2 | P1 | P3 on steps of different heights, joined at a
 * shared baseline. Medal colours come from the rank, so a tie for P2 is two silvers. Rises once
 * when it comes into view (P2 and P3, then P1), counts the points up, sweeps P1's step in gold;
 * under reduced motion it's simply there.
 */
export function TopThree({ rows, meId, movement, round }: { rows: SeasonRow[]; meId?: number; movement?: Map<number, Movement>; round?: number }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const animate = !useReducedMotion();
  const top = rows.slice(0, 3);
  if (top.length < 3) return null;
  const lead = top[0].points;
  const joint = top[1].rank === 1;
  return (
    <section ref={ref} aria-label="Top three">
      <ol className="grid grid-cols-3 items-end">
        {top.map((r, i) => (
          <PodiumPlace key={r.user_id} r={r} place={(i + 1) as 1 | 2 | 3} lead={lead} joint={joint} me={r.user_id === meId}
            move={movement?.get(r.user_id)} round={round} animate={animate} go={inView} />
        ))}
      </ol>
      {/* the baseline: a track edge the steps stand on */}
      <div aria-hidden className="h-px bg-line" />
      <div aria-hidden className="mt-[3px] h-px bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.12)_0_14px,transparent_14px_24px)]" />
    </section>
  );
}

// ---------- timing tower ----------

// pos | move | player | races | wins | gap | points   (phones: pos | move | player | points)
const COLS = 'grid grid-cols-[2.25rem_2rem_minmax(0,1fr)_auto] items-center gap-x-2 sm:grid-cols-[2.75rem_2.5rem_minmax(0,1fr)_3.5rem_3.5rem_4rem_4rem] sm:gap-x-3';

function TowerRow({ r, i, rows, me, lead, move, round, pinned }: {
  r: SeasonRow; i: number; rows: SeasonRow[]; me: boolean; lead: number; move?: Movement; round?: number; pinned?: boolean;
}) {
  const c = medal(r.rank);
  const gap = r.points === lead ? (r.rank === 1 ? 'Leader' : 'Level') : `−${lead - r.points}`;
  return (
    <div id={me && !pinned ? 'me-row' : undefined}
      className={cx(COLS, 'relative min-h-[52px] py-2 pl-3 pr-3 sm:pl-4 sm:pr-4',
        // a bar down the left edge: medal colour for the podium, racing red for you
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
        me ? 'bg-accent/[.08] before:bg-accent' : c ? 'before:bg-[var(--medal)]' : 'before:bg-transparent')}
      style={c ? { ['--medal' as string]: c } : undefined}>
      <span className={cx('num font-display text-xl font-bold leading-none', r.rank <= 3 || me ? 'text-ink' : 'text-muted')}>
        {i >= 0 && tied(rows, i) && <span className="mr-px text-base text-muted" aria-label="tied ">=</span>}{r.rank}
      </span>
      <Move m={move} round={round} />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold leading-tight">
          {r.name}{me && <span className="ml-2 align-middle text-[11px] font-bold uppercase tracking-wider text-accent-hi">You</span>}
        </span>
        <span className="num mt-0.5 block truncate text-xs text-muted sm:hidden">{r.races} {r.races === 1 ? 'race' : 'races'} · {r.wins} {r.wins === 1 ? 'win' : 'wins'}</span>
      </span>
      <span className="num hidden text-center text-sm text-muted sm:block">{r.races}</span>
      <span className="num hidden text-center text-sm text-muted sm:block">{r.wins}</span>
      <span className="num hidden text-right text-sm text-muted sm:block">{gap}</span>
      <span className="text-right">
        <span className="num block font-display text-xl font-bold leading-none">{r.points}</span>
        <span className="num mt-0.5 block text-[11px] text-muted sm:hidden">{gap}</span>
      </span>
    </div>
  );
}

export function LeaderboardTable({ rows, meId, movement, round }: { rows: SeasonRow[]; meId?: number; movement?: Map<number, Movement>; round?: number }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const lead = rows[0]?.points ?? 0;
  const meIndex = rows.findIndex((r) => r.user_id === meId);
  const meRow = meIndex >= 0 ? rows[meIndex] : undefined;

  // your row stays pinned to the bottom of the screen whenever it isn't on it
  const [meVisible, setMeVisible] = useState(true);
  useEffect(() => {
    const el = document.getElementById('me-row');
    if (!el) { setMeVisible(false); return; }
    const io = new IntersectionObserver(([e]) => setMeVisible(e.isIntersecting), { rootMargin: '0px 0px -72px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [view, meId]);

  const jumpToMe = () => {
    setQ('');
    setPage(Math.floor(meIndex / PAGE));
    setTimeout(() => document.getElementById('me-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search players</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search players" type="search" enterKeyHint="search"
            className="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-base placeholder:text-faint focus:border-faint focus:outline-none sm:text-[15px]" />
        </label>
        {meRow && <Button variant="secondary" icon={Crosshair} onClick={jumpToMe} aria-label="Find me" className="w-11 px-0 sm:w-auto sm:px-4"><span className="hidden sm:inline">Find me</span></Button>}
      </div>

      <div className="border-y border-line">
        <div aria-hidden className={cx(COLS, 'sector border-b border-line py-2 pl-3 pr-3 text-[11px] sm:pl-4 sm:pr-4')}>
          <span>Pos</span><span title={round ? `Since round ${round}` : undefined}>{movement ? '+/−' : ''}</span><span>Player</span>
          <span className="hidden text-center sm:block">Races</span><span className="hidden text-center sm:block">Wins</span>
          <span className="hidden text-right sm:block">Gap</span><span className="text-right">Pts</span>
        </div>
        {view.length ? (
          <ol className="divide-y divide-line/70">
            {view.map((r) => {
              const i = rows.indexOf(r);
              return <li key={r.user_id}><TowerRow r={r} i={i} rows={rows} me={r.user_id === meId} lead={lead} move={movement?.get(r.user_id)} round={round} /></li>;
            })}
          </ol>
        ) : <p className="py-8 text-center text-muted">No players match "{q}".</p>}
      </div>

      {meRow && !meVisible && (
        <button type="button" onClick={jumpToMe} aria-label={`You're ${ordinal(meRow.rank)} with ${meRow.points} points. Show my row`}
          className="sticky bottom-[calc(var(--tabbar)+0.5rem)] z-20 mt-2 block w-full overflow-hidden rounded-md border border-accent/50 bg-bg text-left shadow-lift animate-rise md:bottom-4">
          <TowerRow r={meRow} i={meIndex} rows={rows} me lead={lead} move={movement?.get(meRow.user_id)} round={round} pinned />
        </button>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between pt-3">
          <Button variant="ghost" size="sm" icon={ChevronLeft} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="num text-sm text-muted">Page {page + 1} of {pages}</span>
          <Button variant="ghost" size="sm" iconRight={ChevronRight} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
