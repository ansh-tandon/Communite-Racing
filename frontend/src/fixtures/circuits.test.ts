import { circuitPlace, isPast, nextRace, nextUpLabel, CALENDAR } from './circuits';
import { fmtDateTime } from '../utils/format';

const at = (iso: string) => new Date(`${iso}T10:00:00`);

describe('nextRace', () => {
  it('picks the next race on the calendar', () => {
    expect(nextRace(at('2026-10-19'))?.city).toBe('Austin');
  });
  it('keeps a race as next on its own race day', () => {
    expect(nextRace(at('2026-10-25'))?.city).toBe('Austin');
    expect(nextRace(at('2026-10-26'))?.city).toBe('Mexico City');
  });
  it('points at Las Vegas once São Paulo is done', () => {
    expect(nextRace(at('2026-11-09'))?.gp).toBe('Las Vegas Grand Prix');
  });
  it('has nothing next once the season is over', () => {
    expect(nextRace(at('2026-12-07'))).toBeNull();
  });
  it('dims only races already run', () => {
    const now = at('2026-10-19');
    expect(isPast(CALENDAR.find((r) => r.city === 'Singapore')!, now)).toBe(true);
    expect(isPast(CALENDAR.find((r) => r.city === 'Austin')!, now)).toBe(false);
  });
});

describe('nextUpLabel', () => {
  const race = (city: string) => CALENDAR.find((r) => r.city === city)!;
  it('names the race and the city', () => {
    expect(nextUpLabel(race('Austin'))).toBe('Next up: US Grand Prix in Austin');
    expect(nextUpLabel(race('Lusail'))).toBe('Next up: Qatar Grand Prix in Lusail');
  });
  it("doesn't repeat a city the race is named after", () => {
    expect(nextUpLabel(race('Las Vegas'))).toBe('Next up: Las Vegas Grand Prix');
    expect(nextUpLabel(race('Mexico City'))).toBe('Next up: Mexico City Grand Prix');
  });
});

describe('circuitPlace', () => {
  it('places races by circuit name, with accents ignored', () => {
    expect(circuitPlace({ circuit: 'Las Vegas Strip Circuit', name: 'Las Vegas Grand Prix', country: 'United States' })?.city).toBe('Las Vegas');
    expect(circuitPlace({ circuit: 'Autódromo José Carlos Pace', name: 'São Paulo Grand Prix', country: 'Brazil' })?.city).toBe('São Paulo');
  });
  it('returns null rather than guessing', () => {
    expect(circuitPlace({ circuit: 'Unknown Ring', name: 'Mystery Grand Prix', country: 'Atlantis' })).toBeNull();
  });
});

describe('the revised 2026 calendar', () => {
  it('has 23 rounds: Saudi Arabia cancelled, Bahrain held at Sepang', () => {
    expect(CALENDAR).toHaveLength(23);
    expect(CALENDAR.find((r) => r.city === 'Jeddah')).toBeUndefined();
    expect(CALENDAR.find((r) => r.gp === 'Bahrain Grand Prix')).toMatchObject({ city: 'Sepang', round: 16, raceDay: '2026-10-04' });
    expect(CALENDAR.find((r) => r.city === 'Austin')?.round).toBe(18);
    expect(CALENDAR.at(-1)).toMatchObject({ city: 'Abu Dhabi', round: 23 });
  });
  it('shows lights out in IST', () => {
    const at = (city: string) => fmtDateTime(CALENDAR.find((r) => r.city === city)!.start!);
    expect(at('Austin')).toBe('Mon, 26 Oct, 1:30 am IST');
    expect(at('Mexico City')).toBe('Mon, 2 Nov, 1:30 am IST');
    expect(at('São Paulo')).toBe('Sun, 8 Nov, 10:30 pm IST');
    expect(at('Las Vegas')).toBe('Sun, 22 Nov, 9:30 am IST');
    expect(at('Lusail')).toBe('Sun, 29 Nov, 9:30 pm IST');
    expect(at('Abu Dhabi')).toBe('Sun, 6 Dec, 6:30 pm IST');
  });
  it('places the Bahrain GP at Sepang on the globe', () => {
    expect(circuitPlace({ circuit: 'Sepang International Circuit', name: 'Bahrain Grand Prix', country: 'Malaysia' })?.city).toBe('Sepang');
  });
});
