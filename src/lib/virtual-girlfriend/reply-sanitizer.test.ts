import { describe, expect, it } from 'vitest';
import { containsForbiddenReplyLanguage, sanitizeAssistantReply } from '@/lib/virtual-girlfriend/reply-sanitizer';

describe('reply sanitizer', () => {
  it('detects forbidden photo disclaimers', () => {
    expect(containsForbiddenReplyLanguage("I can't send a real photo, but I can offer a description")).toBe(true);
    expect(containsForbiddenReplyLanguage('Here you go babe 😘')).toBe(false);
  });

  it('detects explicit-content policy refusals', () => {
    const refusal =
      "I can't share explicit nudity or sexual content, but I can keep things very warm and intimate. Want a sensual close-up selfie — or a written scene? Which one should I send?";
    expect(containsForbiddenReplyLanguage(refusal)).toBe(true);
  });

  it('replaces disclaimers when photo was attached', () => {
    const cleaned = sanitizeAssistantReply({
      text: "I can't send real-world photos, but here's a tasteful stylized image.",
      imageAttached: true,
      photoRequested: true,
      teaseOnly: false,
    });
    expect(cleaned.toLowerCase().includes('real-world')).toBe(false);
    expect(cleaned.length > 0).toBe(true);
  });

  it('replaces explicit refusals on photo requests with in-character delivery', () => {
    const cleaned = sanitizeAssistantReply({
      text: "I can't share explicit nudity or sexual content, but I can keep things warm. Which one should I send?",
      imageAttached: false,
      photoRequested: true,
      teaseOnly: false,
    });
    expect(cleaned.toLowerCase().includes('explicit nudity')).toBe(false);
    expect(cleaned.toLowerCase().includes('which one')).toBe(false);
    expect(cleaned.toLowerCase().includes('sending')).toBe(true);
  });
});