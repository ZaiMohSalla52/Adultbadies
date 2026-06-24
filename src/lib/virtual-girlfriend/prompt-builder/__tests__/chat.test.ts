import { describe, expect, it } from 'vitest';
import { buildChatPrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/chat';

const baseInput = {
  sex: 'female',
  age: 25,
  origin: 'latina',
  hairColor: 'black',
  hairLength: 'long',
  eyeColor: 'brown',
  bodyType: 'curvy',
};

describe('buildChatPrompt adult capability', () => {
  it('omits SFW content negatives when adult content is enabled', () => {
    const prompt = buildChatPrompt({ ...baseInput, allowAdultContent: true }).toLowerCase();
    expect(prompt.includes('no nudity')).toBe(false);
    expect(prompt.includes('no explicit content')).toBe(false);
    expect(prompt.includes('no triptych')).toBe(true);
  });

  it('keeps SFW content negatives when adult content is disabled', () => {
    const prompt = buildChatPrompt({ ...baseInput, allowAdultContent: false }).toLowerCase();
    expect(prompt.includes('no nudity')).toBe(true);
    expect(prompt.includes('no explicit content')).toBe(true);
  });

  it('adds explicit adult tail when explicit intent is set', () => {
    const prompt = buildChatPrompt({
      ...baseInput,
      allowAdultContent: true,
      explicitIntent: true,
      contextHint: 'bedroom mirror selfie',
    }).toLowerCase();
    expect(prompt.includes('fully explicit')).toBe(true);
    expect(prompt.includes('identity lock')).toBe(true);
  });
});