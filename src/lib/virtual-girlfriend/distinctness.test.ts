import { describe, expect, it } from 'vitest';
import {
  findDistinctnessConflict,
  isCharacterDuplicateConflict,
} from '@/lib/virtual-girlfriend/distinctness';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendStructuredProfile,
} from '@/lib/virtual-girlfriend/types';

const profile = (overrides: Partial<VirtualGirlfriendStructuredProfile>): VirtualGirlfriendStructuredProfile =>
  ({
    schemaVersion: 1,
    name: 'Kai River',
    sex: 'female',
    age: 26,
    origin: 'white',
    hairColor: 'blonde',
    hairLength: 'long',
    eyeColor: 'blue',
    figure: 'slim',
    archetype: 'muse',
    tone: 'playful',
    affectionStyle: 'warm',
    visualAesthetic: 'soft',
    ...overrides,
  }) as VirtualGirlfriendStructuredProfile;

const companion = (structured: VirtualGirlfriendStructuredProfile): VirtualGirlfriendCompanionRecord =>
  ({
    id: 'existing-1',
    user_id: 'u1',
    name: structured.name,
    display_bio: null,
    persona_profile: {} as VirtualGirlfriendCompanionRecord['persona_profile'],
    structured_profile: structured,
    archetype: structured.archetype ?? null,
    tone: structured.tone ?? null,
    affection_style: structured.affectionStyle ?? null,
    visual_aesthetic: structured.visualAesthetic ?? null,
    preference_hints: null,
    profile_tags: null,
    setup_completed: true,
    generation_status: 'ready',
    disclosure_label: '',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as VirtualGirlfriendCompanionRecord;

describe('distinctness — name-only vs character duplicate', () => {
  it('flags an exact name match as a non-blocking name-only conflict when the character is distinct', () => {
    const existing = companion(
      profile({ name: 'Kai River', origin: 'black', hairColor: 'black', eyeColor: 'brown', figure: 'curvy', archetype: 'siren' }),
    );

    const conflict = findDistinctnessConflict({
      candidateProfile: profile({ name: 'Kai River' }),
      existingCompanions: [existing],
    });

    expect(conflict).not.toBe(null);
    expect(conflict!.reasons).toContain('exact_name_match');
    expect(isCharacterDuplicateConflict(conflict!)).toBe(false);
  });

  it('flags a near-identical character as a blocking character duplicate', () => {
    const sameTraits = profile({ name: 'Kai River' });
    const conflict = findDistinctnessConflict({
      candidateProfile: profile({ name: 'Kai River' }),
      existingCompanions: [companion(sameTraits)],
    });

    expect(conflict).not.toBe(null);
    expect(conflict!.reasons).toContain('structured_profile_overlap');
    expect(isCharacterDuplicateConflict(conflict!)).toBe(true);
  });

  it('returns no conflict for a fully distinct profile and name', () => {
    const existing = companion(
      profile({ name: 'Aria Stone', origin: 'black', hairColor: 'black', eyeColor: 'brown', figure: 'curvy', archetype: 'siren' }),
    );

    const conflict = findDistinctnessConflict({
      candidateProfile: profile({ name: 'Kai River' }),
      existingCompanions: [existing],
    });

    expect(conflict).toBe(null);
  });

  it('does not block when only generic demographics overlap (sex, age band, origin)', () => {
    const mia = companion(
      profile({
        name: 'Mia Quinn',
        sex: 'female',
        age: 24,
        origin: 'latina',
        hairColor: 'dark brown',
        hairLength: 'long',
        eyeColor: 'brown',
        figure: 'curvy',
        personality: 'sultry_seductive',
        occupation: 'model',
        archetype: 'siren',
      }),
    );

    const conflict = findDistinctnessConflict({
      candidateProfile: profile({
        name: 'Sofia Reyes',
        sex: 'female',
        age: 24,
        origin: 'latina',
        hairColor: 'blonde',
        hairLength: 'short',
        eyeColor: 'green',
        figure: 'slim',
        personality: 'playful_tease',
        occupation: 'artist',
        archetype: 'muse',
      }),
      existingCompanions: [mia],
    });

    expect(conflict).toBe(null);
  });

  it('blocks when distinctive appearance and vibe traits overlap', () => {
    const mia = companion(
      profile({
        name: 'Mia Quinn',
        sex: 'female',
        age: 24,
        origin: 'latina',
        hairColor: 'dark brown',
        hairLength: 'long',
        eyeColor: 'brown',
        figure: 'curvy',
        personality: 'sultry_seductive',
        occupation: 'model',
        archetype: 'siren',
        tone: 'flirty',
        affectionStyle: 'warm',
        visualAesthetic: 'glamorous',
      }),
    );

    const conflict = findDistinctnessConflict({
      candidateProfile: profile({
        name: 'Luna Vale',
        sex: 'female',
        age: 24,
        origin: 'latina',
        hairColor: 'dark brown',
        hairLength: 'long',
        eyeColor: 'brown',
        figure: 'curvy',
        personality: 'sultry_seductive',
        occupation: 'model',
        archetype: 'siren',
        tone: 'flirty',
        affectionStyle: 'warm',
        visualAesthetic: 'glamorous',
      }),
      existingCompanions: [mia],
    });

    expect(conflict).not.toBe(null);
    expect(isCharacterDuplicateConflict(conflict!)).toBe(true);
  });

  it('ignores a non-ready companion (timeout orphan) so retries are not blocked', () => {
    const sameTraits = profile({ name: 'Sofia Blake' });
    const orphan = { ...companion(sameTraits), generation_status: 'generating' as const };

    const conflict = findDistinctnessConflict({
      candidateProfile: profile({ name: 'Sofia Blake' }),
      existingCompanions: [orphan],
    });

    expect(conflict).toBe(null);
  });
});
