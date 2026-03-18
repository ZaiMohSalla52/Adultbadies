import { describe, expect, it } from 'vitest';
import { buildPreviewPrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/preview';

const femaleTraits = {
  sex: 'female',
  origin: 'south_asian',
  hairColor: 'dark brown',
  hairLength: 'medium',
  eyeColor: 'brown',
  skinTone: 'tan',
  bodyType: 'slim',
  age: 24,
};

describe('buildPreviewPrompt', () => {
  it('includes lighting variant in prompt', () => {
    const p0 = buildPreviewPrompt(femaleTraits, 0).toLowerCase();
    const p1 = buildPreviewPrompt(femaleTraits, 1).toLowerCase();
    expect(p0.includes('front natural lighting')).toBe(true);
    expect(p1.includes('golden side lighting')).toBe(true);
  });

  it('includes framing variant in prompt', () => {
    const p0 = buildPreviewPrompt(femaleTraits, 0).toLowerCase();
    const p1 = buildPreviewPrompt(femaleTraits, 1).toLowerCase();
    expect(p0.includes('tight head and shoulders')).toBe(true);
    expect(p1.includes('tight head and shoulders')).toBe(false);
  });

  it('includes styleVibe cue when provided', () => {
    const traitsWithStyle = {
      ...femaleTraits,
      styleVibe: 'casual',
    };
    const p = buildPreviewPrompt(traitsWithStyle, 0).toLowerCase();
    expect(p.includes('casual everyday style')).toBe(true);
  });

  it('includes personality cue when provided', () => {
    const traitsWithPersonality = {
      ...femaleTraits,
      personality: 'bubbly_energetic',
    };
    const p = buildPreviewPrompt(traitsWithPersonality, 0).toLowerCase();
    expect(p.includes('bright energetic presence')).toBe(true);
  });

  it('omits style cue when styleVibe is random', () => {
    const traitsWithRandom = {
      ...femaleTraits,
      styleVibe: 'random',
    };
    const p = buildPreviewPrompt(traitsWithRandom, 0).toLowerCase();
    expect(p.includes('casual')).toBe(false);
    expect(p.includes('elegant')).toBe(false);
    expect(p.includes('edgy')).toBe(false);
    expect(p.includes('bohemian')).toBe(false);
  });

  it('still contains no triptych negative', () => {
    const p = buildPreviewPrompt(femaleTraits, 0).toLowerCase();
    expect(p.includes('no triptych')).toBe(true);
  });

  it('now contains seam negatives', () => {
    const p = buildPreviewPrompt(femaleTraits, 0).toLowerCase();
    expect(p.includes('no vertical face seam')).toBe(true);
    expect(p.includes('no bilateral face split')).toBe(true);
  });

  it('three axes differ between variants', () => {
    const p0 = buildPreviewPrompt(femaleTraits, 0).toLowerCase();
    const p1 = buildPreviewPrompt(femaleTraits, 1).toLowerCase();
    expect(p0.includes('direct confident gaze')).toBe(true);
    expect(p1.includes('warm genuine smile')).toBe(true);
    expect(p0.includes('front natural lighting')).toBe(true);
    expect(p1.includes('golden side lighting')).toBe(true);
    expect(p0.includes('tight head and shoulders')).toBe(true);
    expect(p1.includes('head and upper chest')).toBe(true);
  });
});
