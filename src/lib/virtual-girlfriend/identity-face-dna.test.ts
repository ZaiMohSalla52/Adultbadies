import { describe, expect, it } from 'vitest';
import {
  buildFaceDnaLine,
  buildFaceDnaTokens,
  collectSiblingDistinctnessCues,
  deriveFaceDnaSeed,
} from '@/lib/virtual-girlfriend/identity-face-dna';
import type { VirtualGirlfriendVisualIdentityPack } from '@/lib/virtual-girlfriend/types';

const baseInput = {
  userId: 'user-1',
  sex: 'female',
  origin: 'latina',
  age: 26,
  hairColor: 'dark brown',
  eyeColor: 'brown',
};

describe('identity-face-dna', () => {
  it('produces stable tokens for the same fingerprint', () => {
    const first = buildFaceDnaTokens({ ...baseInput, variantIndex: 0 });
    const second = buildFaceDnaTokens({ ...baseInput, variantIndex: 0 });
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(5);
  });

  it('varies tokens across companion ids and variant indexes', () => {
    const companionA = buildFaceDnaLine({ ...baseInput, companionId: 'companion-a', variantIndex: 0 });
    const companionB = buildFaceDnaLine({ ...baseInput, companionId: 'companion-b', variantIndex: 0 });
    const variantB = buildFaceDnaLine({ ...baseInput, companionId: 'companion-a', variantIndex: 1 });

    expect(companionA).not.toBe(companionB);
    expect(companionA).not.toBe(variantB);
    expect(companionA.toLowerCase()).toContain('distinct facial dna');
  });

  it('changes preview seed when companion id is present', () => {
    const withoutCompanion = deriveFaceDnaSeed({ ...baseInput, variantIndex: 0 });
    const withCompanion = deriveFaceDnaSeed({ ...baseInput, companionId: 'companion-1', variantIndex: 0 });
    expect(withCompanion).not.toBe(withoutCompanion);
  });

  it('collects sibling distinctness cues from identity packs', () => {
    const pack: VirtualGirlfriendVisualIdentityPack = {
      continuityAnchors: ['dark brown long hair', 'warm olive skin'],
      coreLookDescriptors: ['latina heritage features'],
      portraitFramingStyle: 'portrait',
      wardrobeDirection: 'casual',
      lightingMoodDirection: 'warm',
      cameraCompositionPreferences: ['medium close-up'],
      realismPolishLevel: 'photoreal',
      negativeConstraints: ['plastic skin'],
      negativeOverlapCues: ['do not resemble Maya'],
      identityInvariants: {
        faceShape: 'heart-shaped face',
      },
    };

    const cues = collectSiblingDistinctnessCues([pack]);
    expect(cues).toContain('do not resemble Maya');
    expect(cues).toContain('dark brown long hair');
    expect(cues).toContain('heart-shaped face');
  });
});