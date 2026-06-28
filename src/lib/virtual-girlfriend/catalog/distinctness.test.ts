import { describe, expect, it } from 'vitest';
import { buildCatalogAvoidVisualCues, mergeCatalogFreeformDetails } from '@/lib/virtual-girlfriend/catalog/distinctness';
import type { CatalogCompanionBlueprint } from '@/lib/virtual-girlfriend/catalog/profiles';
import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';

const blueprint = (overrides: Partial<CatalogCompanionBlueprint>): CatalogCompanionBlueprint => ({
  key: 'test',
  name: 'Test',
  archetype: 'test',
  tone: 'test',
  affectionStyle: 'test',
  visualAesthetic: 'test',
  profile: {
    sex: 'female',
    age: 18,
    origin: 'asian',
    hairColor: 'black',
    hairLength: 'long',
    eyeColor: 'brown',
    skinTone: 'light',
    styleVibe: 'casual',
    bodyType: 'slim',
    occupation: 'student',
    personality: 'sweet_caring',
    sexuality: 'straight',
  },
  ...overrides,
});

const sibling = (name: string): VirtualGirlfriendCompanionRecord =>
  ({
    id: `id-${name}`,
    name,
    structured_profile: { occupation: 'student' },
  }) as VirtualGirlfriendCompanionRecord;

describe('catalog distinctness helpers', () => {
  it('injects portrait scene and sibling avoid cues into freeform details', () => {
    const merged = mergeCatalogFreeformDetails(
      blueprint({
        portraitScene: 'OUTDOOR rooftop at dusk',
        profile: { ...blueprint({}).profile, freeformDetails: 'Slim build.' },
      }),
      [sibling('Mika')],
    );

    expect(merged).toContain('CANONICAL PORTRAIT SCENE');
    expect(merged).toContain('OUTDOOR rooftop at dusk');
    expect(merged).toContain('do not resemble Mika');
    expect(merged).toContain('library bookshelves');
  });

  it('adds student clone ban cues when siblings include students', () => {
    const cues = buildCatalogAvoidVisualCues(blueprint({}), [sibling('Mika')]);
    expect(cues.some((cue) => cue.includes('beige'))).toBe(true);
    expect(cues.some((cue) => cue.includes('Mika'))).toBe(true);
  });
});