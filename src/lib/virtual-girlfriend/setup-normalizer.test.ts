import { describe, expect, it } from 'vitest';
import { resolveSetupTraits } from '@/lib/virtual-girlfriend/setup-normalizer';

describe('resolveSetupTraits', () => {
  it('Female → female', () => {
    expect(resolveSetupTraits({ sex: 'Female' }).sex).toBe('female');
  });

  it('Male → male', () => {
    expect(resolveSetupTraits({ sex: 'Male' }).sex).toBe('male');
  });

  it('invalid sex throws', () => {
    expect(() => resolveSetupTraits({ sex: 'unknown' })).toThrow('Invalid sex value');
  });

  it('valid origin enum passes through', () => {
    expect(resolveSetupTraits({ sex: 'Female', origin: 'latina' }).origin).toBe('latina');
  });

  it('Caucasian → white', () => {
    expect(resolveSetupTraits({ sex: 'Female', origin: 'Caucasian' }).origin).toBe('white');
  });

  it('Africa → black', () => {
    expect(resolveSetupTraits({ sex: 'Female', origin: 'Africa' }).origin).toBe('black');
  });

  it('Indian → south_asian', () => {
    const r = resolveSetupTraits({ sex: 'female', origin: 'Indian' });
    expect(r.origin).toBe('south_asian');
  });

  it('Arab → middle_eastern', () => {
    expect(resolveSetupTraits({ sex: 'Female', origin: 'Arab' }).origin).toBe('middle_eastern');
  });


  it('south_asian passes through as south_asian', () => {
    const r = resolveSetupTraits({ sex: 'female', origin: 'south_asian' });
    expect(r.origin).toBe('south_asian');
  });

  it('Random origin resolves to allowed schema value', () => {
    const origin = resolveSetupTraits({ sex: 'Female', origin: 'Random' }).origin;
    const valid = ['asian', 'latina', 'black', 'white', 'mixed', 'middle_eastern', 'south_asian'];
    expect(valid).toContain(origin);
  });

  it('Jet black → black', () => {
    expect(resolveSetupTraits({ sex: 'Female', hairColor: 'Jet black' }).hairColor).toBe('black');
  });

  it('Random hairColor resolves to valid string', () => {
    const hairColor = resolveSetupTraits({ sex: 'Female', hairColor: 'Random' }).hairColor;
    expect(hairColor).toBeTruthy();
    expect(hairColor).not.toBe('random');
  });

  it('Chubby / Plus size → curvy', () => {
    expect(resolveSetupTraits({ sex: 'Female', bodyType: 'Chubby' }).bodyType).toBe('curvy');
    expect(resolveSetupTraits({ sex: 'Female', bodyType: 'Plus size' }).bodyType).toBe('curvy');
  });

  it('Random bodyType resolves to allowed value', () => {
    const bodyType = resolveSetupTraits({ sex: 'Female', bodyType: 'Random' }).bodyType;
    expect(['slim', 'athletic', 'curvy', 'petite']).toContain(bodyType);
  });

  it('string age coerces to number', () => {
    expect(resolveSetupTraits({ sex: 'Female', age: '27' }).age).toBe(27);
  });

  it('Random age resolves to allowed number', () => {
    const age = resolveSetupTraits({ sex: 'Female', age: 'Random' }).age;
    expect([18, 21, 24, 27, 30, 35]).toContain(age);
  });

  it('age clamps below 18', () => {
    expect(resolveSetupTraits({ sex: 'Female', age: '15' }).age).toBe(18);
  });

  it('missing hairLength resolves to allowed value', () => {
    expect(resolveSetupTraits({ sex: 'Female' }).hairLength).toBe('medium');
  });

  it('missing eyeColor resolves to non-random string', () => {
    const eyeColor = resolveSetupTraits({ sex: 'Female' }).eyeColor;
    expect(eyeColor).toBeTruthy();
    expect(eyeColor).not.toBe('random');
  });

  it('missing skinTone resolves to allowed value', () => {
    const skinTone = resolveSetupTraits({ sex: 'Female' }).skinTone;
    expect(['fair', 'light', 'medium', 'tan', 'dark', 'deep']).toContain(skinTone);
  });

  it('Random skinTone resolves to allowed value', () => {
    const skinTone = resolveSetupTraits({ sex: 'Female', skinTone: 'Random' }).skinTone;
    expect(['fair', 'light', 'medium', 'tan', 'dark', 'deep']).toContain(skinTone);
  });
});
