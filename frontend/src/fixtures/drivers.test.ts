import { describe, expect, it } from 'vitest';
import { isDriverList } from './drivers';

describe('isDriverList', () => {
  it('shows driver cards for drivers plus an extra choice like "No retirements" or "Nobody"', () => {
    expect(isDriverList(['NOR', 'VER', 'LEC'])).toBe(true);
    expect(isDriverList(['NOR', 'VER', 'LEC', 'No retirements'])).toBe(true);
    expect(isDriverList(['NOR', 'VER', 'Nobody'])).toBe(true);
  });
  it('keeps lettered answers for teams and other text', () => {
    expect(isDriverList(['McLaren', 'Ferrari', 'Mercedes'])).toBe(false);
    expect(isDriverList(['VER', 'Yes', 'No', 'Maybe'])).toBe(false);
    expect(isDriverList([])).toBe(false);
  });
});

describe('teams', () => {
  it('knows each team\'s colour, badge and two drivers', async () => {
    const { team, isTeamList } = await import('./drivers');
    expect(team('McLaren')).toMatchObject({ short: 'MCL', drivers: ['NOR', 'PIA'] });
    expect(team('Cadillac')?.drivers).toEqual(['PER', 'BOT']);
    expect(team('Not a team')).toBeNull();
    expect(isTeamList(['McLaren', 'Mercedes', 'Red Bull', 'Ferrari', 'Williams', 'Racing Bulls', 'Aston Martin', 'Haas', 'Audi', 'Alpine', 'Cadillac'])).toBe(true);
    expect(isTeamList(['NOR', 'VER'])).toBe(false);
  });
});
