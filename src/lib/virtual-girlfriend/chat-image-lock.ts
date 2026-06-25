import type { VirtualGirlfriendMessageAttachment } from '@/lib/virtual-girlfriend/types';

/** Chat photos stay blurred until the user spends points to unblur — premium included. */
export const applyChatImageLock = (
  attachment: VirtualGirlfriendMessageAttachment,
  unlockedImageIds: string[],
): VirtualGirlfriendMessageAttachment => {
  if (unlockedImageIds.includes(attachment.imageId)) {
    return { ...attachment, locked: false };
  }

  return { ...attachment, locked: true };
};

export const isChatImageUnlocked = (
  attachment: VirtualGirlfriendMessageAttachment,
  unlockedImageIds: Set<string> | string[],
) => {
  const ids = unlockedImageIds instanceof Set ? unlockedImageIds : new Set(unlockedImageIds);
  return ids.has(attachment.imageId);
};