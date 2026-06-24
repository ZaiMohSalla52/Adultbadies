import { describe, expect, it } from 'vitest';
import { containsForbiddenReplyLanguage, sanitizeAssistantReply } from '@/lib/virtual-girlfriend/reply-sanitizer';

describe('reply sanitizer', () => {
  it('detects forbidden photo disclaimers', () => {
    expect(containsForbiddenReplyLanguage("I can't send a real photo, but I can offer a description")).toBe(true);
    expect(containsForbiddenReplyLanguage('Here you go babe 😘')).toBe(false);
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
});