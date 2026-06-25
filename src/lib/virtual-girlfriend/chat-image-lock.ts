import type { VirtualGirlfriendMessageAttachment } from '@/lib/virtual-girlfriend/types';

/** Free users see blurred chat photos until they spend points to unblur. */
export const applyChatImageLock = (
  attachment: VirtualGirlfriendMessageAttachment,
  options: { isPremium: boolean; unlockedImageIds: string[] },
): VirtualGirlfriendMessageAttachment => {
  if (options.isPremium) {
    return { ...attachment, locked: false };
  }

  if (options.unlockedImageIds.includes(attachment.imageId)) {
    return { ...attachment, locked: false };
  }

  return { ...attachment, locked: true };
};

export const isChatImageUnlocked = (
  attachment: VirtualGirlfriendMessageAttachment,
  unlockedImageIds: Set<string> | string[],
) => {
  const ids = unlockedImageIds instanceof Set ? unlockedImageIds : new Set(unlockedImageIds);
  return attachment.locked === false || ids.has(attachment.imageId);
};