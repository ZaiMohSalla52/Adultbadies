import { describe, expect, it } from 'vitest';
import { buildRegeneratePrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/regenerate';

const traits = {
  sex: 'female',
  age: 24,
  origin: 'latina',
  hairColor: 'dark brown',
  hairLength: 'long',
  eyeColor: 'brown',
  bodyType: 'curvy',
};

describe('buildRegeneratePrompt', () => {
  it('honors the selected portrait seed prompt when provided', () => {
    const prompt = buildRegeneratePrompt({
      ...traits,
      seedPromptHint: 'Adult woman with heart-shaped face and warm olive skin.',
      identityAnchors: ['warm olive skin', 'dark brown long hair'],
    });

    expect(prompt.startsWith('Adult woman with heart-shaped face and warm olive skin.')).toBe(true);
    expect(prompt).toContain('Identity continuity: warm olive skin, dark brown long hair.');
  });

  it('falls back to trait-based regeneration without a seed hint', () => {
    const prompt = buildRegeneratePrompt({
      ...traits,
      identityAnchors: ['warm olive skin'],
    });

    expect(prompt.toLowerCase()).toContain('portrait photograph');
    expect(prompt).toContain('warm olive skin');
  });
});