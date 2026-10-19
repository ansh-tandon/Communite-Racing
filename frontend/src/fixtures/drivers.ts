// DEVELOPMENT FIXTURE: display names and team colours for the three-letter codes that
// questions use as options. The backend has no drivers endpoint yet (see BACKEND_GAPS.md);
// when it does, replace this file with an API call. Unknown codes fall back to the code.

export interface DriverInfo { code: string; name: string; team: string; color: string; number?: number }

const TEAM_COLOR: Record<string, string> = {
  McLaren: '#FF8000', 'Red Bull': '#3671C6', Ferrari: '#E8002D', Mercedes: '#27F4D2',
  'Aston Martin': '#229971', Williams: '#1868DB', Alpine: '#00A1E8', Haas: '#B6BABD',
  Audi: '#F50537', 'Racing Bulls': '#6692FF', Cadillac: '#C9B37E',
};

const ROWS: [string, string, string, number][] = [
  ['NOR', 'Lando Norris', 'McLaren', 4], ['PIA', 'Oscar Piastri', 'McLaren', 81],
  ['VER', 'Max Verstappen', 'Red Bull', 1], ['HAD', 'Isack Hadjar', 'Red Bull', 6],
  ['LEC', 'Charles Leclerc', 'Ferrari', 16], ['HAM', 'Lewis Hamilton', 'Ferrari', 44],
  ['RUS', 'George Russell', 'Mercedes', 63], ['ANT', 'Kimi Antonelli', 'Mercedes', 12],
  ['ALO', 'Fernando Alonso', 'Aston Martin', 14], ['STR', 'Lance Stroll', 'Aston Martin', 18],
  ['SAI', 'Carlos Sainz', 'Williams', 55], ['ALB', 'Alex Albon', 'Williams', 23],
  ['GAS', 'Pierre Gasly', 'Alpine', 10], ['COL', 'Franco Colapinto', 'Alpine', 43],
  ['OCO', 'Esteban Ocon', 'Haas', 31], ['BEA', 'Oliver Bearman', 'Haas', 87],
  ['HUL', 'Nico Hülkenberg', 'Audi', 27], ['BOR', 'Gabriel Bortoleto', 'Audi', 5],
  ['LAW', 'Liam Lawson', 'Racing Bulls', 30], ['LIN', 'Arvid Lindblad', 'Racing Bulls', 41],
  ['PER', 'Sergio Pérez', 'Cadillac', 11], ['BOT', 'Valtteri Bottas', 'Cadillac', 77],
];

const BY_CODE = new Map(ROWS.map(([code, name, team, number]) => [code, { code, name, team, number, color: TEAM_COLOR[team] }]));

export const DRIVER_CODES = ROWS.map((r) => r[0]);

export function driver(code: string): DriverInfo | null {
  return BY_CODE.get(code) ?? null;
}

/** "Lando Norris" for a known code, the option text itself otherwise (e.g. "McLaren"). */
export function optionLabel(option: string): string {
  return BY_CODE.get(option)?.name ?? option;
}

export const isDriverList = (options: string[]) => options.length > 0 && options.every((o) => BY_CODE.has(o));
