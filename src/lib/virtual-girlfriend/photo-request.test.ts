import { describe, expect, it } from 'vitest';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import { resolveImageMomentFromIntent } from '@/lib/virtual-girlfriend/intimacy';

describe('photo request heuristic', () => {
  it('detects selfie requests in natural language', () => {
    expect(looksLikePhotoRequest('Send me a selfie 😊')).toBe(true);
    expect(looksLikePhotoRequest('hey how was your day')).toBe(false);
  });

  it('routes selfie requests to send_now with fresh generation for premium', () => {
    const intent = buildHeuristicPhotoIntent('Send me a selfie');
    const moment = resolveImageMomentFromIntent({ intent, history: [], isPremium: true });
    expect(moment.shouldSendImage).toBe(true);
    expect(moment.preferFreshGeneration).toBe(true);
    expect(intent.companionGuidance.toLowerCase().includes('never')).toBe(true);
  });
});