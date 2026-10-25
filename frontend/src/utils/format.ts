import type { Phase, RaceSummary } from '../api/types';

// The league plays from India: every date and time is shown in IST, whatever the phone's
// clock is set to, and says so ("Mon, 26 Oct, 1:30 am IST").
export const TZ = 'Asia/Kolkata';
const dt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
const d = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: TZ });
const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });

export const fmtDateTime = (iso: string) => `${dt.format(new Date(iso))} IST`;
export const fmtDate = (iso: string) => d.format(new Date(iso));
/** "Mon, 26 Oct" and "1:30 am IST", for layouts that put the day and the time on separate lines. */
export const fmtDay = (iso: string) => day.format(new Date(iso));
export const fmtTime = (iso: string) => `${time.format(new Date(iso))} IST`;
export const two = (n: number) => String(n).padStart(2, '0');

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function relative(iso: string) {
  const ms = Date.parse(iso) - Date.now();
  const abs = Math.abs(ms), h = abs / 3_600_000;
  const txt = h < 1 ? `${Math.max(1, Math.round(abs / 60_000))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;
  return ms >= 0 ? `in ${txt}` : `${txt} ago`;
}

export const PHASE_LABEL: Record<Phase, string> = {
  upcoming: 'Opens soon',
  open: 'Predictions open',
  closed: 'Locked · awaiting results',
  results: 'Results final',
};

/** The race the app should lead with: the open quiz, else the next upcoming, else the latest result. */
/** The race to put front and centre, by time rather than round number (a practice quiz can have any round):
 *  1. a race that's live or just finished: locked within the last 12 hours and not published yet
 *  2. the open quiz that locks soonest
 *  3. the quiz that opens soonest
 *  4. an older locked quiz still awaiting results, then the latest results */
export function featuredRace(list: RaceSummary[], now: Date = new Date()): RaceSummary | undefined {
  const t = (iso: string) => new Date(iso).getTime();
  const by = (k: 'quiz_opens_at' | 'quiz_closes_at', dir = 1) => (a: RaceSummary, b: RaceSummary) => dir * (t(a[k]) - t(b[k]));
  const closed = list.filter((r) => r.phase === 'closed').sort(by('quiz_closes_at', -1));
  return closed.find((r) => now.getTime() - t(r.quiz_closes_at) < 12 * 3600_000)
    ?? list.filter((r) => r.phase === 'open').sort(by('quiz_closes_at'))[0]
    ?? list.filter((r) => r.phase === 'upcoming').sort(by('quiz_opens_at'))[0]
    ?? closed[0]
    ?? list.filter((r) => r.phase === 'results').sort(by('quiz_closes_at', -1))[0];
}

export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
