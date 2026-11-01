import { describe, expect, it } from 'vitest';
import { seasonAt } from './season';

describe('seasonAt', () => {
  it('dresses up for Día de Muertos, 31 Oct to 3 Nov in India', () => {
    expect(seasonAt(new Date('2026-10-30T18:29:00Z'))).toBe(null);       // 30 Oct, 11:59 pm IST
    expect(seasonAt(new Date('2026-10-30T18:30:00Z'))).toBe('muertos');  // 31 Oct, midnight IST
    expect(seasonAt(new Date('2026-11-01T20:00:00Z'))).toBe('muertos');  // Mexico GP lights out
    expect(seasonAt(new Date('2026-11-03T18:29:00Z'))).toBe('muertos');  // 3 Nov, 11:59 pm IST
    expect(seasonAt(new Date('2026-11-03T18:30:00Z'))).toBe(null);       // 4 Nov
  });
});
