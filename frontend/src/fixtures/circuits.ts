// Development fixture: where each circuit is, for the globe on the quiz screen.
// The backend doesn't serve coordinates yet (see BACKEND_GAPS.md). A race we can't
// place shows the globe without a pin rather than a guessed one.

export interface CircuitPlace {
  city: string;
  lat: number;
  lng: number;
}

// `keys` are matched against the race's circuit and name; `country` only when it
// has a single circuit on the calendar.
const PLACES: (CircuitPlace & { keys: string[]; country?: string })[] = [
  { city: 'Sepang', lat: 2.7606, lng: 101.7381, keys: ['sepang'], country: 'malaysia' },
  { city: 'Sakhir', lat: 26.0325, lng: 50.5106, keys: ['bahrain international', 'sakhir'], country: 'bahrain' },
  { city: 'Jeddah', lat: 21.6319, lng: 39.1044, keys: ['jeddah', 'corniche'], country: 'saudi arabia' },
  { city: 'Melbourne', lat: -37.8497, lng: 144.968, keys: ['albert park', 'melbourne'], country: 'australia' },
  { city: 'Suzuka', lat: 34.8431, lng: 136.5407, keys: ['suzuka'], country: 'japan' },
  { city: 'Shanghai', lat: 31.3389, lng: 121.2197, keys: ['shanghai'], country: 'china' },
  { city: 'Miami', lat: 25.9581, lng: -80.2389, keys: ['miami'] },
  { city: 'Imola', lat: 44.3439, lng: 11.7167, keys: ['imola', 'enzo e dino ferrari', 'emilia'] },
  { city: 'Monaco', lat: 43.7347, lng: 7.4206, keys: ['monaco', 'monte carlo'], country: 'monaco' },
  { city: 'Barcelona', lat: 41.57, lng: 2.2611, keys: ['catalunya', 'barcelona'] },
  { city: 'Madrid', lat: 40.4637, lng: -3.6158, keys: ['madring', 'madrid'] },
  { city: 'Montréal', lat: 45.5, lng: -73.5228, keys: ['gilles villeneuve', 'montreal'], country: 'canada' },
  { city: 'Spielberg', lat: 47.2197, lng: 14.7647, keys: ['red bull ring', 'spielberg'], country: 'austria' },
  { city: 'Silverstone', lat: 52.0786, lng: -1.0169, keys: ['silverstone', 'british'], country: 'united kingdom' },
  { city: 'Budapest', lat: 47.5789, lng: 19.2486, keys: ['hungaroring'], country: 'hungary' },
  { city: 'Spa', lat: 50.4372, lng: 5.9714, keys: ['spa-francorchamps', 'francorchamps'], country: 'belgium' },
  { city: 'Zandvoort', lat: 52.3888, lng: 4.5409, keys: ['zandvoort', 'dutch'], country: 'netherlands' },
  { city: 'Monza', lat: 45.6156, lng: 9.2811, keys: ['monza', 'italian grand prix'] },
  { city: 'Baku', lat: 40.3725, lng: 49.8533, keys: ['baku'], country: 'azerbaijan' },
  { city: 'Singapore', lat: 1.2914, lng: 103.864, keys: ['marina bay'], country: 'singapore' },
  { city: 'Austin', lat: 30.1328, lng: -97.6411, keys: ['circuit of the americas', 'austin', 'united states grand prix'] },
  { city: 'Mexico City', lat: 19.4042, lng: -99.0907, keys: ['hermanos rodriguez', 'mexico city'], country: 'mexico' },
  { city: 'São Paulo', lat: -23.7036, lng: -46.6997, keys: ['interlagos', 'jose carlos pace', 'sao paulo'], country: 'brazil' },
  { city: 'Las Vegas', lat: 36.1147, lng: -115.1728, keys: ['las vegas'] },
  { city: 'Lusail', lat: 25.49, lng: 51.4542, keys: ['lusail', 'losail'], country: 'qatar' },
  { city: 'Abu Dhabi', lat: 24.4672, lng: 54.6031, keys: ['yas marina', 'abu dhabi'], country: 'united arab emirates' },
];

// The calendar in race order, for the login globe (the race list needs a login). The 2026
// calendar as revised during the season: Saudi Arabia cancelled, and the Bahrain GP moved to
// Sepang (4 Oct), so the rounds run 1-23. Lights out is in UTC, from the official start times
// (FIA update of 5 Aug 2026); the app shows it in IST. Qatar and Abu Dhabi were still in doubt
// in October 2026 (Imola stands by). Update each season, or replace with a public calendar
// endpoint (BACKEND_GAPS.md).
const CALENDAR_2026: [city: string, gp: string, raceDay: string, start?: string][] = [
  ['Melbourne', 'Australian Grand Prix', '2026-03-08'],
  ['Shanghai', 'Chinese Grand Prix', '2026-03-15'],
  ['Suzuka', 'Japanese Grand Prix', '2026-03-29'],
  ['Miami', 'Miami Grand Prix', '2026-05-03'],
  ['Montréal', 'Canadian Grand Prix', '2026-05-24'],
  ['Monaco', 'Monaco Grand Prix', '2026-06-07'],
  ['Barcelona', 'Barcelona-Catalunya Grand Prix', '2026-06-14'],
  ['Spielberg', 'Austrian Grand Prix', '2026-06-28'],
  ['Silverstone', 'British Grand Prix', '2026-07-05'],
  ['Spa', 'Belgian Grand Prix', '2026-07-19'],
  ['Budapest', 'Hungarian Grand Prix', '2026-07-26'],
  ['Zandvoort', 'Dutch Grand Prix', '2026-08-23'],
  ['Monza', 'Italian Grand Prix', '2026-09-06'],
  ['Madrid', 'Spanish Grand Prix', '2026-09-13'],
  ['Baku', 'Azerbaijan Grand Prix', '2026-09-26', '2026-09-26T11:00:00Z'], // Sat 3pm local
  ['Sepang', 'Bahrain Grand Prix', '2026-10-04', '2026-10-04T07:00:00Z'], // 3pm local, in Malaysia
  ['Singapore', 'Singapore Grand Prix', '2026-10-11', '2026-10-11T12:00:00Z'], // 8pm local
  ['Austin', 'United States Grand Prix', '2026-10-25', '2026-10-25T20:00:00Z'], // 3pm local (CDT)
  ['Mexico City', 'Mexico City Grand Prix', '2026-11-01', '2026-11-01T20:00:00Z'], // 2pm local
  ['São Paulo', 'São Paulo Grand Prix', '2026-11-08', '2026-11-08T17:00:00Z'], // 2pm local
  ['Las Vegas', 'Las Vegas Grand Prix', '2026-11-21', '2026-11-22T04:00:00Z'], // Sat 8pm local
  ['Lusail', 'Qatar Grand Prix', '2026-11-29', '2026-11-29T16:00:00Z'], // 7pm local
  ['Abu Dhabi', 'Abu Dhabi Grand Prix', '2026-12-06', '2026-12-06T13:00:00Z'], // 5pm local
];

export interface CalendarRace extends CircuitPlace {
  round: number;
  gp: string;
  raceDay: string; // YYYY-MM-DD, local race day
  start?: string; // lights out, ISO in UTC, where the official time is known
}

export const CALENDAR: CalendarRace[] = CALENDAR_2026.map(([city, gp, raceDay, start], i) => {
  const p = PLACES.find((x) => x.city === city)!;
  return { city: p.city, lat: p.lat, lng: p.lng, round: i + 1, gp, raceDay, start };
});

// a race counts as run two hours after lights out; without an official time, once its day is over
const RACE_HOURS = 2 * 3_600_000;
const over = (r: CalendarRace, now: Date) => (r.start ? Date.parse(r.start) + RACE_HOURS <= now.getTime() : r.raceDay < isoDay(now));

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The next race on or after `now` (race day counts until it's over), or null once the season ends. */
export function nextRace(now = new Date()): CalendarRace | null {
  return CALENDAR.find((r) => !over(r, now)) ?? null;
}

/** "Next up: US Grand Prix in Austin"; the city is left out when the race is named after it. */
export function nextUpLabel(r: CalendarRace) {
  const gp = r.gp.replace(/^United States /, 'US ');
  return gp.includes(r.city) ? `Next up: ${gp}` : `Next up: ${gp} in ${r.city}`;
}

/** True for races already run, so the globe can dim them. */
export const isPast = (r: CalendarRace, now = new Date()) => over(r, now);

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function circuitPlace(race: { circuit: string; name: string; country: string }): CircuitPlace | null {
  const text = norm(`${race.circuit} ${race.name}`);
  const byKey = PLACES.find((p) => p.keys.some((k) => text.includes(k)));
  const country = norm(race.country);
  const hit = byKey ?? PLACES.find((p) => p.country === country);
  return hit ? { city: hit.city, lat: hit.lat, lng: hit.lng } : null;
}
