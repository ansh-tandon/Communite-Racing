import { describe, expect, it } from 'vitest';
import { seasonAt } from './season';

describe('seasonAt', () => {
  it('dresses up for Día de Muertos, 31 Oct to 7 Nov in India', () => {
    expect(seasonAt(new Date('2026-10-30T18:29:00Z'))).toBe(null);       // 30 Oct, 11:59 pm IST
    expect(seasonAt(new Date('2026-10-30T18:30:00Z'))).toBe('muertos');  // 31 Oct, midnight IST
    expect(seasonAt(new Date('2026-11-01T20:00:00Z'))).toBe('muertos');  // Mexico GP lights out
    expect(seasonAt(new Date('2026-11-07T18:29:00Z'))).toBe('muertos');  // 7 Nov, 11:59 pm IST
  });
  it('lights up for Diwali from midnight on 8 Nov until 6 am on the 9th, India time', () => {
    expect(seasonAt(new Date('2026-11-07T18:30:00Z'))).toBe('diwali');   // 8 Nov, midnight IST
    expect(seasonAt(new Date('2026-11-08T17:00:00Z'))).toBe('diwali');   // São Paulo GP lights out
    expect(seasonAt(new Date('2026-11-09T00:29:00Z'))).toBe('diwali');   // 9 Nov, 5:59 am IST
    expect(seasonAt(new Date('2026-11-09T00:30:00Z'))).toBe(null);       // 9 Nov, 6 am IST
  });
});
