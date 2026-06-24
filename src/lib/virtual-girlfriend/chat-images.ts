import { decideIntimateImageMoment } from '@/lib/virtual-girlfriend/intimacy';
import { runChatImageMachine } from '@/lib/virtual-girlfriend/image-machine';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

export type { IntimateImageMoment } from '@/lib/virtual-girlfriend/intimacy';

export const decideVirtualGirlfriendImageMoment = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
}) => decideIntimateImageMoment(input);

export const resolveVirtualGirlfriendChatImage = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  category: VirtualGirlfriendImageCategory;
  existingImages: VirtualGirlfriendCompanionImageRecord[];
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  allowFreshGeneration: boolean;
  userMessage?: string;
  visualSceneHint?: string;
  preferFreshGeneration?: boolean;
}) => {
  const result = await runChatImageMachine({ kind: 'chat_image', ...input });
  return { outcome: result.outcome, attachment: result.attachment, reason: result.reason };
};
