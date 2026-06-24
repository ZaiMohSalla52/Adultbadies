import { describe, expect, it } from 'vitest';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import { resolveImageMomentFromIntent } from '@/lib/virtual-girlfriend/intimacy';

describe('photo request heuristic', () => {
  it('detects selfie requests in natural language', () => {
    expect(looksLikePhotoRequest('Send me a selfie 😊')).toBe(true);
    expect(looksLikePhotoRequest('hey how was your day')).toBe(false);
  });

  it('detects explicit body-part photo requests without the word photo', () => {
    expect(looksLikePhotoRequest('i want to see your tits')).toBe(true);
    expect(looksLikePhotoRequest('send me photo of your tits')).toBe(true);
  });

  it('routes selfie requests to send_now with fresh generation for premium', () => {
    const intent = buildHeuristicPhotoIntent('Send me a selfie');
    const moment = resolveImageMomentFromIntent({ intent, history: [], isPremium: true });
    expect(moment.shouldSendImage).toBe(true);
    expect(moment.preferFreshGeneration).toBe(true);
    expect(intent.companionGuidance.toLowerCase().includes('never')).toBe(true);
  });

  it('routes explicit requests to fresh generation even for free users', () => {
    const intent = buildHeuristicPhotoIntent('send me photo of your tits');
    const moment = resolveImageMomentFromIntent({
      intent,
      history: [],
      isPremium: false,
      userMessage: 'send me photo of your tits',
    });
    expect(moment.shouldSendImage).toBe(true);
    expect(moment.preferFreshGeneration).toBe(true);
    expect(intent.visualSceneHint?.toLowerCase()).toContain('explicit');
  });
});