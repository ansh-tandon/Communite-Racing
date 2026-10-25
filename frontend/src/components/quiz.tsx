import { Check, ChevronUp, Minus, Plus, X } from 'lucide-react';
import type { AnswerValue, Question } from '../api/types';
import { driver, isDriverList, optionLabel } from '../fixtures/drivers';
import { cx } from './ui';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const TYPE_LABEL: Record<Question['type'], string> = {
  single: 'Pick one', multi: 'Pick several', ranked: 'Put in order', number: 'Number', yes_no: 'Yes or no',
};

/** "−5": what a wrong answer costs, or '' when there's no negative marking. */
export const penaltyLabel = (q: Question) => (q.config.penalty ? `−${q.config.penalty}` : '');

export function describe(q: Question): string {
  const base = describeType(q);
  const wrong = q.config.penalty ? `A wrong answer costs ${q.config.penalty} point${q.config.penalty === 1 ? '' : 's'}; leave it blank to score 0.` : '';
  return [base, wrong].filter(Boolean).join(' ');
}

function describeType(q: Question): string {
  if (q.type === 'multi') return `Choose ${q.config.pick}. Order doesn't matter${q.config.scoring === 'all' ? '; all must be right to score' : '; each correct pick scores'}.`;
  if (q.type === 'ranked') return `Choose ${q.config.pick} in order${q.config.scoring === 'all' ? '; the whole order must be right' : '; points for each one in the right place'}.`;
  if (q.type === 'number') return q.config.tolerance ? `Within ${q.config.tolerance} either side scores full points.` : 'Exact number to score.';
  return '';
}

/** Readable form of any answer value, used in reviews and admin. */
export function formatValue(q: Question, v: AnswerValue | undefined): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return q.type === 'ranked' ? v.map((x, i) => `P${i + 1} ${driver(x)?.code ?? x}`).join(' · ') : v.map((x) => driver(x)?.code ?? x).join(' · ');
  return typeof v === 'string' ? optionLabel(v) : String(v);
}

// ---------- answer option cards ----------

/** A driver to pick: car number in team colour, name, code and team. Two to a row on phones. */
export function DriverCard({ code, selected, marker, disabled, onClick, state }: {
  code: string; selected: boolean; marker?: string; disabled?: boolean; onClick?: () => void; state?: 'correct' | 'wrong';
}) {
  const d = driver(code);
  const [first, ...rest] = (d?.name ?? code).split(' ');
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      style={{ ['--team' as string]: d?.color ?? '#5E6672' }}
      className={cx(
        'relative flex min-h-[60px] items-center gap-2.5 overflow-hidden rounded-lg border py-2 pl-3.5 pr-2.5 text-left transition-[border-color,background-color,transform,opacity] duration-150 active:scale-[.98]',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--team)]',
        selected ? 'animate-pop border-accent bg-accent/[.09]' : 'border-line bg-surface hover:border-faint hover:bg-surface2',
        state === 'correct' && 'border-ok bg-ok/10', state === 'wrong' && !selected && 'opacity-45',
        disabled && 'cursor-default active:scale-100',
      )}>
      <span className="num w-7 shrink-0 text-center font-display text-[22px] font-black italic leading-none text-[var(--team)]">{d?.number ?? ''}</span>
      <span className="min-w-0 flex-1">
        {/* surname only on phones; the full name is still read out */}
        <span className="block truncate text-[15px] font-semibold leading-tight">
          {rest.length ? <><span className="max-sm:sr-only">{first} </span>{rest.join(' ')}</> : first}
        </span>
        {d && <span className="mt-0.5 block truncate text-xs text-muted">{code} · {d.team}</span>}
      </span>
      {marker ? <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-md bg-accent px-1.5 font-display text-sm font-bold text-white">{marker}</span>
        : selected ? <Check className="h-5 w-5 shrink-0 text-accent-hi" aria-hidden /> : null}
    </button>
  );
}

export function AnswerOption({ label, marker, selected, disabled, onClick }: { label: string; marker: string; selected: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={cx('flex min-h-[56px] items-center gap-3.5 rounded-lg border px-3.5 py-3 text-left font-semibold transition duration-150 active:scale-[.98]',
        selected ? 'animate-pop border-accent bg-accent/[.09]' : 'border-line bg-surface hover:border-faint hover:bg-surface2', disabled && 'cursor-default active:scale-100')}>
      <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-md font-display text-base font-bold', selected ? 'bg-accent text-white' : 'bg-surface3 text-muted')}>{marker}</span>
      {label}
    </button>
  );
}

// ---------- podium ----------

/** Tap drivers to fill P1, P2, P3 in turn. Each filled step can move up a place or be cleared. */
function PodiumSelector({ q, value, onChange, disabled }: { q: Question; value: string[]; onChange: (v: string[] | null) => void; disabled?: boolean }) {
  const pick = q.config.pick ?? 3;
  const toggle = (code: string) => {
    if (value.includes(code)) { const n = value.filter((c) => c !== code); onChange(n.length ? n : null); }
    else if (value.length < pick) onChange([...value, code]);
  };
  const up = (i: number) => {
    if (i < 1) return;
    const n = [...value]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n);
  };
  const order = pick === 3 ? [1, 0, 2] : Array.from({ length: pick }, (_, i) => i);
  const height = (i: number) => (pick === 3 ? ['h-24 sm:h-28', 'h-16 sm:h-20', 'h-12 sm:h-14'][i] : 'h-16');
  const tool = 'grid h-11 w-11 place-items-center rounded-md text-muted transition hover:bg-surface2 hover:text-ink active:scale-95';
  return (
    <div className="space-y-6">
      <ol className={cx('grid items-end gap-2 sm:gap-3', pick === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')} aria-label="Your order">
        {order.map((i) => {
          const code = value[i], d = code ? driver(code) : null;
          return (
            <li key={i} className="flex min-w-0 flex-col items-stretch">
              <div className="mb-2 text-center">
                {code ? (
                  <div className="animate-rise">
                    <p className="truncate font-display text-lg font-bold uppercase leading-tight sm:text-xl">{d?.name.split(' ').slice(-1)[0] ?? code}</p>
                    {!disabled && (
                      <div className="mt-0.5 flex justify-center">
                        {i > 0 && <button type="button" onClick={() => up(i)} aria-label={`Move ${code} up`} className={tool}><ChevronUp className="h-5 w-5" /></button>}
                        <button type="button" onClick={() => toggle(code)} aria-label={`Remove ${code}`} className={cx(tool, 'hover:text-accent-hi')}><X className="h-5 w-5" /></button>
                      </div>
                    )}
                  </div>
                ) : <p className="pb-2 text-sm text-faint">{value.length === i && !disabled ? 'Tap a driver' : ' '}</p>}
              </div>
              <div style={{ ['--team' as string]: d?.color ?? 'transparent' }}
                className={cx('relative flex items-start justify-center rounded-t-lg border-x border-t pt-2 transition-colors', height(i),
                  code ? 'border-line bg-surface2 after:absolute after:inset-x-0 after:top-0 after:h-[3px] after:rounded-t-lg after:bg-[var(--team)]' : 'border-dashed border-line')}>
                <span className={cx('font-display text-2xl font-black sm:text-3xl', code ? 'text-ink' : 'text-faint')}>P{i + 1}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <DriverGrid options={q.options} isSelected={(c) => value.includes(c)} marker={(c) => (value.includes(c) ? `P${value.indexOf(c) + 1}` : undefined)} onPick={toggle} disabled={disabled} />
    </div>
  );
}

function DriverGrid({ options, isSelected, marker, onPick, disabled, keyValue }: {
  options: string[]; isSelected: (c: string) => boolean; marker?: (c: string) => string | undefined; onPick: (c: string) => void; disabled?: boolean; keyValue?: AnswerValue;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3" role="group">
      {options.map((c) => {
        const correct = keyValue !== undefined && (Array.isArray(keyValue) ? keyValue.includes(c) : keyValue === c);
        return <DriverCard key={c} code={c} selected={isSelected(c)} marker={marker?.(c)} disabled={disabled} onClick={() => onPick(c)} state={keyValue !== undefined ? (correct ? 'correct' : 'wrong') : undefined} />;
      })}
    </div>
  );
}

// ---------- number ----------

/** Big stepper plus a slider. Until the player touches it, the middle value is only a suggestion. */
function NumberInput({ q, value, onChange, disabled }: { q: Question; value: number | undefined; onChange: (v: number) => void; disabled?: boolean }) {
  const min = q.config.min ?? 0, max = q.config.max ?? 99;
  const v = value ?? Math.round((min + max) / 2);
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  const idle = value === undefined;
  const step = 'grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line bg-surface2 transition hover:bg-surface3 active:scale-95 disabled:opacity-30';
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-6 sm:px-8">
      <div className="flex items-center justify-center gap-5 sm:gap-10">
        <button type="button" disabled={disabled || v <= min} onClick={() => set(v - 1)} aria-label="Decrease" className={step}><Minus className="h-6 w-6" /></button>
        <output className={cx('num min-w-[2ch] text-center font-display text-[88px] font-black leading-none sm:text-[112px]', idle && 'text-faint')} aria-live="polite">{v}</output>
        <button type="button" disabled={disabled || v >= max} onClick={() => set(v + 1)} aria-label="Increase" className={step}><Plus className="h-6 w-6" /></button>
      </div>
      <div className="mx-auto mt-4 max-w-md">
        <input type="range" min={min} max={max} value={v} disabled={disabled} onChange={(e) => set(+e.target.value)} aria-label={q.prompt}
          className="range w-full" style={{ ['--pct' as string]: `${((v - min) / (max - min || 1)) * 100}%`, ['--fill' as string]: idle ? '#5E6672' : '#E10600' }} />
        <div className="num flex justify-between text-xs text-muted"><span>{min}</span><span>{max}</span></div>
      </div>
      {idle && !disabled && (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={() => set(v)} className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-4 text-sm font-semibold transition hover:bg-surface2 active:scale-[.98]">
            <Check className="h-4 w-4 text-accent-hi" aria-hidden />Go with {v}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- the renderer ----------

export function QuestionRenderer({ q, value, onChange, disabled, keyValue, isKey }: {
  q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue | null) => void; disabled?: boolean;
  /** Admin entering the real result: "pick several" may list more than players pick. */
  isKey?: boolean;
  /** When results are out: the correct value, used to mark options. */
  keyValue?: AnswerValue;
}) {
  const drivers = isDriverList(q.options);
  switch (q.type) {
    case 'single':
      return drivers
        ? <DriverGrid options={q.options} isSelected={(c) => value === c} onPick={(c) => onChange(value === c ? null : c)} disabled={disabled} keyValue={keyValue} />
        : <div className="grid gap-2 sm:grid-cols-2">{q.options.map((o, i) => <AnswerOption key={o} label={o} marker={LETTERS[i]} selected={value === o} disabled={disabled} onClick={() => onChange(value === o ? null : o)} />)}</div>;
    case 'multi': {
      const list = (value as string[] | undefined) ?? [];
      const pick = isKey ? q.options.length : q.config.pick ?? 1;
      const toggle = (c: string) => {
        if (list.includes(c)) { const n = list.filter((x) => x !== c); onChange(n.length ? n : null); }
        else if (list.length < pick) onChange([...list, c]);
      };
      return (
        <div className="space-y-3">
          <p className="num text-sm" aria-live="polite">
            <span className={cx('font-semibold', list.length === pick && !isKey ? 'text-ok' : 'text-ink')}>{isKey ? `${list.length} selected` : `${list.length} of ${pick} picked`}</span>
            {list.length === pick && !disabled && !isKey && <span className="text-muted">. That's all of them; tap a pick to free a place.</span>}
          </p>
          {drivers
            ? <DriverGrid options={q.options} isSelected={(c) => list.includes(c)} onPick={toggle} disabled={disabled} keyValue={keyValue} />
            : <div className="grid gap-2 sm:grid-cols-2">{q.options.map((o, i) => <AnswerOption key={o} label={o} marker={LETTERS[i]} selected={list.includes(o)} disabled={disabled} onClick={() => toggle(o)} />)}</div>}
        </div>
      );
    }
    case 'ranked':
      return <PodiumSelector q={q} value={(value as string[] | undefined) ?? []} onChange={onChange} disabled={disabled} />;
    case 'number':
      return <NumberInput q={q} value={value as number | undefined} onChange={onChange} disabled={disabled} />;
    case 'yes_no':
      return (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {[true, false].map((b) => (
            <button key={String(b)} type="button" disabled={disabled} aria-pressed={value === b} onClick={() => onChange(value === b ? null : b)}
              className={cx('flex h-28 items-center justify-center rounded-xl border font-display text-5xl font-black uppercase transition duration-150 active:scale-[.98] sm:h-36 sm:text-6xl',
                value === b ? 'animate-pop border-accent bg-accent text-white' : 'border-line bg-surface text-ink/80 hover:border-faint hover:bg-surface2',
                keyValue === b && 'ring-2 ring-ok ring-offset-2 ring-offset-bg', disabled && 'cursor-default active:scale-100')}>
              {b ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      );
  }
}
