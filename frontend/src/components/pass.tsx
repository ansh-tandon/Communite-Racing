import { ChevronRight } from 'lucide-react';
import type { AnswerValue, Question, RaceDetail } from '../api/types';
import { driver, isDriverList, optionLabel } from '../fixtures/drivers';
import { isComplete } from '../utils/answers';
import { fmtDay, fmtTime, initials, ordinal, two } from '../utils/format';
import { cx } from './ui';

/** A driver as a code chip edged in team colour, e.g. ▌NOR. */
function Chip({ code, prefix }: { code: string; prefix?: string }) {
  const d = driver(code);
  return (
    <span style={{ borderColor: d?.color ?? '#5E6672' }} title={d?.name}
      className="inline-flex h-7 items-center gap-1 rounded-sm border-l-[3px] bg-surface2 pl-1.5 pr-2 font-display text-[15px] font-bold leading-none">
      {prefix && <span className="text-muted">{prefix}</span>}{d ? code : optionLabel(code)}
    </span>
  );
}

function Pick({ q, v }: { q: Question; v: AnswerValue | undefined }) {
  if (v === undefined || v === null) return <span className="font-semibold text-warn">Not answered</span>;
  if (typeof v === 'boolean') return <span className="font-display text-xl font-bold uppercase leading-none">{v ? 'Yes' : 'No'}</span>;
  if (typeof v === 'number') return <span className="num font-display text-xl font-bold leading-none">{v}</span>;
  const list = Array.isArray(v) ? v : [v];
  if (!isDriverList(list)) return <span className="font-semibold">{list.map(optionLabel).join(', ')}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {list.map((c, i) => <Chip key={c} code={c} prefix={q.type === 'ranked' ? `P${i + 1}` : undefined} />)}
    </span>
  );
}

type Status = 'open' | 'locked' | 'scored' | 'preview';
const STAMP: Record<Status, [string, string]> = {
  open: ['Open', 'border-ok/50 text-ok'],
  locked: ['Locked', 'border-warn/60 text-warn'],
  scored: ['Scored', 'border-ink/70 text-ink'],
  preview: ['Not open', 'border-line text-muted'],
};

/**
 * The Prediction Pass: the player's picks for one race as a ticket. Header with the race, a row per
 * question (tap to change it while the quiz is open), a perforation, then the stub with lock time,
 * player and pass code. Sized to read as a phone screenshot at 390px.
 */
export function PredictionPass({ race, answers, player, editable, onEdit }: {
  race: RaceDetail; answers: Record<string, AnswerValue>; player: string; editable: boolean; onEdit: (i: number) => void;
}) {
  const res = race.results;
  const status: Status = res ? 'scored' : race.phase === 'upcoming' ? 'preview' : editable ? 'open' : 'locked';
  const gp = /\s+grand prix$/i.test(race.name);
  const code = `R${two(race.round)}-${String(race.id).padStart(3, '0')}-${initials(player) || 'CR'}`;
  const edge = 'border-x border-line bg-surface';

  return (
    <article aria-label={`Prediction Pass, ${race.name}`} className="relative mx-auto w-full max-w-[440px] animate-rise">
      <header className={cx(edge, 'rounded-t-xl border-t px-5 pb-4 pt-5')}>
        <div className="flex items-center justify-between gap-3">
          <p className="sector">Prediction Pass</p>
          <span className={cx('rounded-sm border px-2 py-0.5 font-display text-sm font-bold uppercase tracking-[0.12em]', STAMP[status][1])}>{STAMP[status][0]}</span>
        </div>
        <p className="mt-4 text-sm text-muted">Round {race.round} · {race.season}</p>
        <h2 className="mt-1 font-display text-[44px] font-black uppercase leading-[0.88] [overflow-wrap:anywhere] sm:text-5xl">
          {gp ? race.name.replace(/\s+grand prix$/i, '') : race.name}
        </h2>
        <p className="mt-1.5 text-sm text-muted">{gp && 'Grand Prix · '}{race.circuit}</p>
      </header>

      <ol className={cx(edge, 'px-2 pb-2')}>
        {race.questions.map((q, i) => {
          const v = answers[q.id];
          const pts = res?.points_by_question[q.id];
          const body = (<>
            <span className="num w-6 shrink-0 pt-0.5 font-display text-base font-bold text-faint">{two(i + 1)}</span>
            <span className="min-w-0 flex-1">
              <span className="mb-1.5 block truncate text-[13px] text-muted">{q.prompt}</span>
              <Pick q={q} v={v} />
            </span>
            {res ? (
              <span className={cx('num shrink-0 self-center font-display text-lg font-bold', pts === q.weight ? 'text-ok' : pts ? 'text-warn' : 'text-faint')}>
                {pts ?? 0}<span className="text-sm text-faint">/{q.weight}</span>
              </span>
            ) : editable && <ChevronRight className="h-5 w-5 shrink-0 self-center text-faint" aria-hidden />}
          </>);
          return (
            <li key={q.id} className="border-t border-line/70 first:border-t-0">
              {editable
                ? <button type="button" onClick={() => onEdit(i)} aria-label={`Question ${i + 1}: ${q.prompt}. ${isComplete(q, v) ? 'Change' : 'Answer'} it`}
                    className="flex min-h-[60px] w-full items-start gap-3 rounded-md px-3 py-3 text-left transition hover:bg-surface2 active:bg-surface2">{body}</button>
                : <div className="flex items-start gap-3 px-3 py-3">{body}</div>}
            </li>
          );
        })}
      </ol>

      {/* perforation: two notches cut from the edges and a dashed tear line */}
      <div className={cx(edge, 'relative h-6')} aria-hidden>
        <span className="absolute -left-3 top-0 h-6 w-6 rounded-full border border-line bg-bg [clip-path:inset(0_0_0_50%)]" />
        <span className="absolute -right-3 top-0 h-6 w-6 rounded-full border border-line bg-bg [clip-path:inset(0_50%_0_0)]" />
        <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
      </div>

      <footer className={cx(edge, 'animate-stub rounded-b-xl border-b px-5 pb-5 pt-3')}>
        {res && (
          <p className="mb-4 flex items-baseline justify-between gap-3">
            <span className="num font-display text-5xl font-black leading-none">{res.points ?? 0}<span className="text-2xl text-faint"> / {res.max_points}</span></span>
            {res.rank && <span className="font-display text-xl font-bold uppercase">{ordinal(res.rank)} place</span>}
          </p>
        )}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-5 gap-y-1 text-sm">
          <dt className="text-xs text-muted">{status === 'open' ? 'Locks' : 'Locked'}</dt>
          <dt className="text-xs text-muted">Player</dt>
          <dt className="text-xs text-muted">Pass</dt>
          <dd className="num font-semibold">{fmtDay(race.quiz_closes_at)}<br />{fmtTime(race.quiz_closes_at)}</dd>
          <dd className="truncate font-semibold">{player}</dd>
          <dd className="num font-display text-[15px] font-bold tracking-wide">{code}</dd>
        </dl>
      </footer>
    </article>
  );
}
