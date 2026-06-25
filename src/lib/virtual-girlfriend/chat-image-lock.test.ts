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
  it('locks fresh chat photos until points are spent', () => {
    const locked = applyChatImageLock(sampleAttachment(), []);
    expect(locked.locked).toBe(true);
  });

  it('locks premium chat photos until points are spent', () => {
    const locked = applyChatImageLock(sampleAttachment(), []);
    expect(locked.locked).toBe(true);
  });

  it('respects previously unlocked image ids', () => {
    const locked = applyChatImageLock(sampleAttachment(), ['img-1']);
    expect(locked.locked).toBe(false);
    expect(isChatImageUnlocked(locked, ['img-1'])).toBe(true);
  });
});