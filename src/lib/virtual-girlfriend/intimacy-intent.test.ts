import { describe, expect, it } from 'vitest';
import { resolveImageMomentFromIntent } from '@/lib/virtual-girlfriend/intimacy';

describe('semantic intent mapping', () => {
  it('maps paraphrased user intent without keyword dependence', () => {
    const paraphrases = [
      'I need to see more of you',
      'Show me how you look right now',
      'Can I get another shot of you',
    ];

    for (const companionGuidance of paraphrases) {
      const decision = resolveImageMomentFromIntent({
        intent: {
          intimacyActive: true,
          wantsPhoto: true,
          photoDelivery: 'tease_first',
          visualSceneHint: null,
          imageCategory: 'selfie',
          powerDynamic: 'companion_leads',
          companionGuidance: `User message means: ${companionGuidance}`,
        },
        history: [],
        isPremium: true,
      });
      expect(decision.teaseOnly).toBe(true);
    }
  });
});