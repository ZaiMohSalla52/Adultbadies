import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import { runChatImageMachine } from '@/lib/virtual-girlfriend/image-machine';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const CATEGORY_KEYWORDS: Record<VirtualGirlfriendImageCategory, RegExp> = {
  selfie: /\bselfie|photo|pic|picture|look like\b/i,
  casual: /\bcasual|chill|relaxed\b/i,
  outfit: /\boutfit|dress|wearing|fit check\b/i,
  indoor: /\bindoor|inside|at home|room\b/i,
  'night-out': /\bnight ?out|party|club|evening\b/i,
  'good-morning': /\bgood\s*morning|morning\b/i,
  'good-night': /\bgood\s*night|night\b/i,
  lifestyle: /\blifestyle|day|daily|vibe\b/i,
};

const IMAGE_REQUEST_PATTERN =
  /\b(send|show|share|drop).{0,30}\b(selfie|photo|pic|picture|nude|naked|body|lingerie|nsfw)|\bwhat do you look like\b|\b(nude|naked|topless|nsfw)\s*(pic|photo|selfie)?\b/i;

export const detectRequestedImageCategory = (message: string): VirtualGirlfriendImageCategory => {
  const normalized = message.toLowerCase();
  const matched = Object.entries(CATEGORY_KEYWORDS).find(([, pattern]) => pattern.test(normalized));
  return (matched?.[0] as VirtualGirlfriendImageCategory | undefined) ?? 'selfie';
};

export const decideVirtualGirlfriendImageMoment = (input: {
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
}) => {
  const directRequest = IMAGE_REQUEST_PATTERN.test(input.userMessage) || detectExplicitImageIntent(input.userMessage);
  const lastAssistantImageAt = [...input.history]
    .reverse()
    .find((message) => message.role === 'assistant' && message.attachments?.some((a) => a.kind === 'image'));

  const minutesSinceLastImage = lastAssistantImageAt
    ? (Date.now() - new Date(lastAssistantImageAt.created_at).getTime()) / (1000 * 60)
    : Infinity;

  const contextualNudge = /\bmiss you|show me|need to see you|wish i could see you\b/i.test(input.userMessage);
  const rateLimited = minutesSinceLastImage < 18;

  if (directRequest && !rateLimited) {
    return { shouldSendImage: true, category: detectRequestedImageCategory(input.userMessage), trigger: 'user-request' as const };
  }

  if (contextualNudge && input.isPremium && !rateLimited) {
    return {
      shouldSendImage: true,
      category: detectRequestedImageCategory(input.userMessage),
      trigger: 'contextual-initiative' as const,
    };
  }

  return { shouldSendImage: false, category: detectRequestedImageCategory(input.userMessage), trigger: 'none' as const };
};

export const resolveVirtualGirlfriendChatImage = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  category: VirtualGirlfriendImageCategory;
  existingImages: VirtualGirlfriendCompanionImageRecord[];
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  allowFreshGeneration: boolean;
  userMessage?: string;
}) => {
  const result = await runChatImageMachine({ kind: 'chat_image', ...input });
  return { outcome: result.outcome, attachment: result.attachment, reason: result.reason };
};
