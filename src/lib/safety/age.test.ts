import { describe, expect, it } from 'vitest';
import { computeAge, isAdultDateOfBirth, isValidDateOfBirth } from '@/lib/safety/age';

describe('computeAge', () => {
  const reference = new Date('2026-06-24T00:00:00Z');

  it('computes whole-year age before a birthday', () => {
    expect(computeAge('2008-12-01', reference)).toBe(17);
  });

  it('computes whole-year age after a birthday', () => {
    expect(computeAge('2008-01-01', reference)).toBe(18);
  });

  it('handles the exact birthday as a full year', () => {
    expect(computeAge('2008-06-24', reference)).toBe(18);
  });
});

describe('isAdultDateOfBirth', () => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();

  it('rejects someone who just turned 17', () => {
    expect(isAdultDateOfBirth(`${yyyy - 17}-01-01`)).toBe(false);
  });

  it('accepts someone clearly over 18', () => {
    expect(isAdultDateOfBirth(`${yyyy - 30}-01-01`)).toBe(true);
  });
});

describe('isValidDateOfBirth', () => {
  it('rejects malformed dates', () => {
    expect(isValidDateOfBirth('not-a-date')).toBe(false);
    expect(isValidDateOfBirth('2008-13-40')).toBe(false);
  });

  it('rejects future dates', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(isValidDateOfBirth(future)).toBe(false);
  });

  it('accepts a plausible adult date', () => {
    expect(isValidDateOfBirth('1995-05-05')).toBe(true);
  });
});
