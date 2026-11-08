// Seasonal themes: a short window of the year when the site dresses up. Colours swap through CSS variables on
// <html data-season> (styles/index.css); decorations check isSeason(). Dates are India time, like the league.

export type Season = 'muertos' | 'diwali';

/** Día de Muertos, the Mexico City GP weekend: 31 Oct to 7 Nov, India time. */
export function seasonAt(now: Date = new Date()): Season | null {
  const ist = new Date(now.getTime() + 330 * 60_000); // UTC+5:30, read with the UTC getters
  const m = ist.getUTCMonth(), d = ist.getUTCDate();
  // Diwali 2026 is 8 Nov. It runs to 6 am on the 9th so the São Paulo GP (10:30 pm to past midnight) stays lit.
  if (ist.getUTCFullYear() === 2026 && m === 10 && (d === 8 || (d === 9 && ist.getUTCHours() < 6))) return 'diwali';
  return (m === 9 && d === 31) || (m === 10 && d <= 7) ? 'muertos' : null;
}

export const season = seasonAt();

export function applySeason(): void {
  if (season) document.documentElement.dataset.season = season;
  if (season === 'diwali') document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#140A1A');
}
