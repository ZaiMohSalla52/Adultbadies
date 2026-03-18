import { SURFACE_PARAMS } from '../../image-surfaces';
import { normalizeToCompanionTraits } from '../normalize';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toThrow: () => void;
};

describe('normalizeToCompanionTraits', () => {
  it('normalizes valid female input', () => {
    const result = normalizeToCompanionTraits({
      sex: 'female',
      age: 24,
      origin: 'asian',
      hairColor: 'Black',
      hairLength: 'medium',
      eyeColor: 'Brown',
      figure: 'slim',
    });
    expect(result.sex).toBe('female');
    expect(result.age).toBe(24);
    expect(result.origin).toBe('asian');
    expect(result.hairColor).toBe('black');
    expect(result.eyeColor).toBe('brown');
    expect(result.bodyType).toBe('slim');
  });

  it('normalizes figure field to bodyType', () => {
    const result = normalizeToCompanionTraits({
      sex: 'female',
      origin: 'white',
      figure: 'curvy',
    });
    expect(result.bodyType).toBe('curvy');
  });

  it('clamps age below 18 to 18', () => {
    const result = normalizeToCompanionTraits({
      sex: 'female',
      origin: 'white',
      age: 15,
    });
    expect(result.age).toBe(18);
  });

  it('clamps age above 99 to 99', () => {
    const result = normalizeToCompanionTraits({
      sex: 'female',
      origin: 'white',
      age: 120,
    });
    expect(result.age).toBe(99);
  });

  it('throws on invalid sex', () => {
    expect(() =>
      normalizeToCompanionTraits({
        sex: 'unknown',
        origin: 'white',
      })
    ).toThrow();
  });

  it('defaults missing optional fields', () => {
    const result = normalizeToCompanionTraits({
      sex: 'male',
      origin: 'black',
    });
    expect(result.hairColor).toBe('brown');
    expect(result.hairLength).toBe('medium');
    expect(result.eyeColor).toBe('brown');
    expect(result.bodyType).toBe('slim');
    expect(result.age).toBe(25);
  });
});

describe('SURFACE_PARAMS', () => {
  it('preview uses REALISTIC style', () => {
    expect(SURFACE_PARAMS.preview.style_type).toBe('REALISTIC');
  });

  it('canonical uses REALISTIC style', () => {
    expect(SURFACE_PARAMS.canonical.style_type).toBe('REALISTIC');
  });

  it('chat uses AUTO style', () => {
    expect(SURFACE_PARAMS.chat.style_type).toBe('AUTO');
  });

  it('all surfaces use num_images 1', () => {
    Object.values(SURFACE_PARAMS).forEach((params) => {
      expect(params.num_images).toBe(1);
    });
  });

  it('all portrait surfaces use magic_prompt OFF', () => {
    const portraitSurfaces = ['preview', 'canonical', 'regenerate', 'gallery'] as const;
    portraitSurfaces.forEach((surface) => {
      expect(SURFACE_PARAMS[surface].magic_prompt_option).toBe('OFF');
    });
  });

  it('all portrait surfaces use 3x4 ratio', () => {
    const portraitSurfaces = ['preview', 'canonical', 'regenerate', 'gallery'] as const;
    portraitSurfaces.forEach((surface) => {
      expect(SURFACE_PARAMS[surface].aspect_ratio).toBe('3x4');
    });
  });
});
