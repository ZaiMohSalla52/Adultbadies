import { describe, expect, it } from 'vitest';
import {
  decideIntimateImageMoment,
  detectComplianceSignal,
  detectPhotoRequest,
  detectSpecificVisualRequest,
} from '@/lib/virtual-girlfriend/intimacy';
import type { VirtualGirlfriendMessageRecord } from '@/lib/virtual-girlfriend/types';

let messageId = 0;
const msg = (role: 'user' | 'assistant', content: string): VirtualGirlfriendMessageRecord => ({
  id: `m-${messageId += 1}`,
  conversation_id: 'c1',
  user_id: 'u1',
  role,
  content,
  model: null,
  token_count: null,
  moderation: {},
  content_type: 'text',
  attachments: [],
  created_at: new Date().toISOString(),
});

describe('intimacy detection', () => {
  it('detects blunt photo requests', () => {
    expect(detectPhotoRequest('Send me picture')).toBe(true);
    expect(detectPhotoRequest('send another photo')).toBe(true);
  });

  it('detects specific visual requests', () => {
    expect(detectSpecificVisualRequest('can i see them unbuttoned')).toBe(true);
    expect(detectSpecificVisualRequest('i thought id be seeing you pantless')).toBe(true);
  });

  it('detects compliance signals', () => {
    expect(detectComplianceSignal('yes mistress')).toBe(true);
    expect(detectComplianceSignal('i just did')).toBe(true);
  });
});

describe('decideIntimateImageMoment', () => {
  it('teases on blunt photo request without prior engagement', () => {
    const decision = decideIntimateImageMoment({
      userMessage: 'Send me picture',
      history: [],
      isPremium: true,
    });
    expect(decision.teaseOnly).toBe(true);
    expect(decision.shouldSendImage).toBe(false);
  });

  it('sends image for specific visual requests', () => {
    const decision = decideIntimateImageMoment({
      userMessage: 'can i see them unbuttoned',
      history: [],
      isPremium: true,
    });
    expect(decision.shouldSendImage).toBe(true);
    expect(decision.teaseOnly).toBe(false);
    expect(decision.visualSceneHint).toContain('unbuttoned');
  });

  it('rewards compliance in an intimate thread', () => {
    const history = [
      msg('assistant', 'Stand up and unbutton your pants. Are you ready?'),
      msg('user', 'yes mistress'),
    ];
    const decision = decideIntimateImageMoment({
      userMessage: 'i just did',
      history,
      isPremium: true,
    });
    expect(decision.shouldSendImage).toBe(true);
    expect(decision.trigger).toBe('compliance-reward');
  });
});