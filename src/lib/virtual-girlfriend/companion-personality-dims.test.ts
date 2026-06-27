import { describe, expect, it } from 'vitest';
import {
  buildCompanionPersonalityDimensionsGuide,
  resolveCompanionPersonalityDimensions,
} from '@/lib/virtual-girlfriend/companion-personality-dims';
import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';

const baseCompanion = (overrides: Partial<VirtualGirlfriendCompanionRecord> = {}): VirtualGirlfriendCompanionRecord => ({
  id: 'companion-1',
  user_id: 'user-1',
  source: 'user',
  name: 'Luna',
  display_bio: null,
  persona_profile: {} as VirtualGirlfriendCompanionRecord['persona_profile'],
  archetype: 'flirty',
  tone: 'playful',
  affection_style: 'teasing',
  visual_aesthetic: 'nightlife glam',
  preference_hints: null,
  profile_tags: [],
  setup_completed: true,
  disclosure_label: 'AI-generated profile',
  generation_status: 'ready',
  is_active: true,
  structured_profile: {
    personality: 'sarcastic_witty',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('companion-personality-dims', () => {
  it('maps sarcastic preset to high humor and playfulness', () => {
    const dims = resolveCompanionPersonalityDimensions(baseCompanion());
    expect(dims.humor).toBe('high');
    expect(dims.playfulness).toBe('high');
  });

  it('maps sweet caring preset to high empathy', () => {
    const dims = resolveCompanionPersonalityDimensions(
      baseCompanion({
        structured_profile: { personality: 'sweet_caring' },
        tone: 'soft',
        affection_style: 'caring',
      }),
    );
    expect(dims.empathy).toBe('high');
  });

  it('includes setup anchors in the guide', () => {
    const guide = buildCompanionPersonalityDimensionsGuide(baseCompanion());
    expect(guide).toContain('Relationship personality dimensions');
    expect(guide).toContain('archetype flirty');
    expect(guide).toContain('Sarcastic & witty');
  });
});