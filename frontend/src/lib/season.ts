// Seasonal themes: a short window of the year when the site dresses up. Colours swap through CSS variables on
// <html data-season> (styles/index.css); decorations check isSeason(). Dates are India time, like the league.

export type Season = 'muertos';

/** Día de Muertos, the Mexico City GP weekend: 31 Oct to 7 Nov, India time. */
export function seasonAt(now: Date = new Date()): Season | null {
  const ist = new Date(now.getTime() + 330 * 60_000); // UTC+5:30, read with the UTC getters
  const m = ist.getUTCMonth(), d = ist.getUTCDate();
  return (m === 9 && d === 31) || (m === 10 && d <= 7) ? 'muertos' : null;
}

export const season = seasonAt();

export function applySeason(): void {
  if (season) document.documentElement.dataset.season = season;
}
