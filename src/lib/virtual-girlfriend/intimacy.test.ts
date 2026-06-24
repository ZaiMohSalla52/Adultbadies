import { describe, expect, it } from 'vitest';
import type { ChatTurnIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
import { resolveImageMomentFromIntent } from '@/lib/virtual-girlfriend/intimacy';
import type { VirtualGirlfriendMessageRecord } from '@/lib/virtual-girlfriend/types';

const intent = (overrides: Partial<ChatTurnIntent>): ChatTurnIntent => ({
  intimacyActive: true,
  wantsPhoto: false,
  photoDelivery: 'none',
  visualSceneHint: null,
  imageCategory: 'selfie',
  powerDynamic: 'balanced',
  companionGuidance: 'Stay flirty and natural.',
  ...overrides,
});

describe('resolveImageMomentFromIntent', () => {
  it('teases when the model chooses tease_first regardless of exact wording', () => {
    const decision = resolveImageMomentFromIntent({
      intent: intent({
        wantsPhoto: true,
        photoDelivery: 'tease_first',
        companionGuidance: 'User wants more visuals but has not followed your last dare yet.',
      }),
      history: [],
      isPremium: true,
    });
    expect(decision.teaseOnly).toBe(true);
    expect(decision.shouldSendImage).toBe(false);
  });

  it('sends when the model infers a specific visual moment', () => {
    const decision = resolveImageMomentFromIntent({
      intent: intent({
        wantsPhoto: true,
        photoDelivery: 'send_now',
        visualSceneHint: 'Mirror selfie with jeans unbuttoned, playful smirk, same identity.',
        companionGuidance: 'Describe the photo they asked for while staying dominant and warm.',
      }),
      history: [],
      isPremium: true,
    });
    expect(decision.shouldSendImage).toBe(true);
    expect(decision.teaseOnly).toBe(false);
    expect(decision.visualSceneHint).toContain('unbuttoned');
    expect(decision.preferFreshGeneration).toBe(true);
  });

  it('rewards compliance when the model reads the scene that way', () => {
    const decision = resolveImageMomentFromIntent({
      intent: intent({
        wantsPhoto: true,
        photoDelivery: 'reward_compliance',
        companionGuidance: 'Praise them for doing what you asked and send a reward photo.',
      }),
      history: [],
      isPremium: true,
    });
    expect(decision.shouldSendImage).toBe(true);
    expect(decision.trigger).toBe('compliance-reward');
  });

  it('does not send when the model says no photo fits this beat', () => {
    const decision = resolveImageMomentFromIntent({
      intent: intent({
        intimacyActive: true,
        wantsPhoto: false,
        photoDelivery: 'none',
        companionGuidance: 'Keep building tension in text only.',
      }),
      history: [],
      isPremium: true,
    });
    expect(decision.shouldSendImage).toBe(false);
    expect(decision.teaseOnly).toBe(false);
  });
});