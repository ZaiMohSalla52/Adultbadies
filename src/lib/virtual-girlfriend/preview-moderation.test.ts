import { describe, expect, it } from 'vitest';
import { buildPreviewPrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/preview';
import {
  isAdultForwardPreviewTraits,
  softenPreviewPromptForModeration,
} from '@/lib/virtual-girlfriend/preview-moderation';
import { isTogetherNsfwModerationError } from '@/lib/virtual-girlfriend/together-image-config';

describe('preview-moderation', () => {
  it('detects adult-forward preview traits', () => {
    expect(isAdultForwardPreviewTraits('seductive', 'warm_romantic')).toBe(true);
    expect(isAdultForwardPreviewTraits('casual', 'sultry_seductive')).toBe(true);
    expect(isAdultForwardPreviewTraits('casual', 'warm_romantic')).toBe(false);
  });

  it('softens stacked seductive wording', () => {
    const softened = softenPreviewPromptForModeration(
      'Sultry seductive gaze, parted lips, magnetic adult allure. Minimal bedroom or living-room setting, intimate and real.',
    );
    expect(softened.toLowerCase()).not.toContain('parted lips');
    expect(softened.toLowerCase()).not.toContain('bedroom');
    expect(softened.toLowerCase()).toContain('magnetic adult presence');
  });

  it('avoids Together moderation triggers in seductive setup previews', () => {
    const prompt = buildPreviewPrompt(
      {
        sex: 'female',
        origin: 'white',
        hairColor: 'blonde',
        hairLength: 'long',
        eyeColor: 'blue',
        bodyType: 'curvy',
        age: 24,
        styleVibe: 'seductive',
        personality: 'sultry_seductive',
        breastSize: 'large',
      },
      9,
    ).toLowerCase();

    expect(prompt).not.toContain('bedroom');
    expect(prompt).not.toContain('parted lips');
    expect(prompt).not.toContain('youthful smooth skin');
    expect(prompt).not.toContain('full bust');
    expect(prompt).not.toContain('no nudity');
    expect(prompt).toContain('natural skin texture');
    expect(prompt).toContain('adult glamour');
  });

  it('detects Together NSFW moderation errors', () => {
    expect(
      isTogetherNsfwModerationError(
        new Error('Together preview generation failed (black-forest-labs/FLUX.2-max): image may contain NSFW content'),
      ),
    ).toBe(true);
  });
});