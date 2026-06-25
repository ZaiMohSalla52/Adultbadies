import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import { classifyChatTurnIntent, type ChatTurnIntent, type PhotoDeliveryIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
import { wardrobeContextFromCompanion } from '@/lib/virtual-girlfriend/companion-wardrobe';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageRecord,
} from '@/lib/virtual-girlfriend/types';

export type { ChatTurnIntent, PhotoDeliveryIntent } from '@/lib/virtual-girlfriend/intimacy-intent';

export type IntimateImageMoment = {
  shouldSendImage: boolean;
  teaseOnly: boolean;
  category: VirtualGirlfriendImageCategory;
  trigger: 'user-request' | 'contextual-initiative' | 'compliance-reward' | 'none';
  intimacyMode: boolean;
  visualSceneHint?: string;
  preferFreshGeneration: boolean;
  intent: ChatTurnIntent;
};

const minutesSinceLastImage = (history: VirtualGirlfriendMessageRecord[]) => {
  const lastAssistantImageAt = [...history]
    .reverse()
    .find((message) => message.role === 'assistant' && message.attachments?.some((a) => a.kind === 'image'));

  if (!lastAssistantImageAt) return Infinity;

  return (Date.now() - new Date(lastAssistantImageAt.created_at).getTime()) / (1000 * 60);
};

export const resolveImageMomentFromIntent = (input: {
  intent: ChatTurnIntent;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
  userMessage?: string;
}): IntimateImageMoment => {
  const { intent } = input;
  const explicitRequest = input.userMessage ? detectExplicitImageIntent(input.userMessage) : false;
  const rateLimitMinutes = intent.intimacyActive ? 5 : 12;
  const rateLimited = minutesSinceLastImage(input.history) < rateLimitMinutes;

  const base = {
    category: intent.imageCategory,
    intimacyMode: intent.intimacyActive,
    intent,
  };

  if (!intent.wantsPhoto || intent.photoDelivery === 'none') {
    return {
      ...base,
      shouldSendImage: false,
      teaseOnly: false,
      trigger: 'none',
      preferFreshGeneration: false,
    };
  }

  if (intent.photoDelivery === 'tease_first') {
    return {
      ...base,
      shouldSendImage: false,
      teaseOnly: true,
      trigger: 'user-request',
      preferFreshGeneration: false,
    };
  }

  if (rateLimited && !explicitRequest) {
    return {
      ...base,
      shouldSendImage: false,
      teaseOnly: true,
      trigger: 'user-request',
      preferFreshGeneration: false,
    };
  }

  const preferFreshGeneration =
    explicitRequest
    || intent.photoDelivery === 'send_now'
    || intent.photoDelivery === 'reward_compliance';

  const trigger =
    intent.photoDelivery === 'reward_compliance'
      ? 'compliance-reward'
      : intent.photoDelivery === 'send_now'
        ? 'user-request'
        : 'contextual-initiative';

  return {
    ...base,
    shouldSendImage: true,
    teaseOnly: false,
    trigger,
    visualSceneHint: intent.visualSceneHint ?? undefined,
    preferFreshGeneration,
  };
};

export const decideIntimateImageMoment = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
  intent?: ChatTurnIntent;
}): Promise<IntimateImageMoment> => {
  const intent =
    input.intent
    ?? (looksLikePhotoRequest(input.userMessage)
      ? buildHeuristicPhotoIntent(input.userMessage, wardrobeContextFromCompanion(input.companion))
      : await classifyChatTurnIntent(input));
  return resolveImageMomentFromIntent({
    intent,
    history: input.history,
    isPremium: input.isPremium,
    userMessage: input.userMessage,
  });
};

export const buildIntimacyResponseGuidance = (input: {
  imageMoment: IntimateImageMoment;
  imageAttached: boolean;
}) => {
  const { intent } = input.imageMoment;
  const lines: string[] = [intent.companionGuidance];

  if (intent.intimacyActive) {
    lines.push(
      'Stay immersive and adult-appropriate. Use short texting bubbles. Infer what the user wants from context — do not wait for specific trigger words.',
    );
  }

  if (intent.powerDynamic === 'companion_leads') {
    lines.push('You are leading the scene confidently — warm, teasing, in control. One light *action* per turn is fine.');
  } else if (intent.powerDynamic === 'user_leads') {
    lines.push('Let the user lead; respond eagerly and match their requested dynamic.');
  }

  lines.push(
    'FORBIDDEN: never refuse explicit/sensual content, never say you cannot share nudity or sexual content, never offer written scenes or text alternatives, never ask which format to send, never say you cannot send photos, never mention being AI/virtual unless user explicitly asks.',
  );

  if (input.imageMoment.teaseOnly) {
    lines.push(
      'No photo is attached this turn. Tease and set one clear next step — flirt in-character, do NOT offer descriptions or disclaim photos.',
    );
  }

  if (input.imageAttached) {
    lines.push(
      'A photo of you IS attached and visible right now. Caption it flirtily in-character. NEVER say you cannot send photos or offer alternatives.',
    );
    if (input.imageMoment.visualSceneHint) {
      lines.push(`Visual intent: ${input.imageMoment.visualSceneHint}`);
    }
  }

  return lines.filter(Boolean).join(' ');
};