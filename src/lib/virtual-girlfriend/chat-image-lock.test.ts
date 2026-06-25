import { describe, expect, it } from 'vitest';
import { applyChatImageLock, isChatImageUnlocked } from '@/lib/virtual-girlfriend/chat-image-lock';
import type { VirtualGirlfriendMessageAttachment } from '@/lib/virtual-girlfriend/types';

const sampleAttachment = (overrides?: Partial<VirtualGirlfriendMessageAttachment>): VirtualGirlfriendMessageAttachment => ({
  kind: 'image',
  category: 'selfie',
  imageId: 'img-1',
  imageUrl: 'https://example.com/photo.jpg',
  width: 1024,
  height: 1024,
  source: 'fresh-generation',
  ...overrides,
});

describe('chat image lock', () => {
  it('locks fresh chat photos for free users', () => {
    const locked = applyChatImageLock(sampleAttachment(), { isPremium: false, unlockedImageIds: [] });
    expect(locked.locked).toBe(true);
  });

  it('keeps premium chat photos unlocked', () => {
    const locked = applyChatImageLock(sampleAttachment(), { isPremium: true, unlockedImageIds: [] });
    expect(locked.locked).toBe(false);
  });

  it('respects previously unlocked image ids', () => {
    const locked = applyChatImageLock(sampleAttachment(), { isPremium: false, unlockedImageIds: ['img-1'] });
    expect(locked.locked).toBe(false);
    expect(isChatImageUnlocked(locked, ['img-1'])).toBe(true);
  });
});