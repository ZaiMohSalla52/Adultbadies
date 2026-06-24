import { classifyChatTurnIntent, type ChatTurnIntent, type PhotoDeliveryIntent } from '@/lib/virtual-girlfriend/intimacy-intent';
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
}): IntimateImageMoment => {
  const { intent } = input;
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
    };
  }

  if (intent.photoDelivery === 'tease_first') {
    return {
      ...base,
      shouldSendImage: false,
      teaseOnly: true,
      trigger: 'user-request',
    };
  }

  if (rateLimited) {
    return {
      ...base,
      shouldSendImage: false,
      teaseOnly: false,
      trigger: 'none',
    };
  }

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
  };
};

export const decideIntimateImageMoment = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
}): Promise<IntimateImageMoment> => {
  const intent = await classifyChatTurnIntent(input);
  return resolveImageMomentFromIntent({
    intent,
    history: input.history,
    isPremium: input.isPremium,
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

  if (input.imageMoment.teaseOnly) {
    lines.push(
      'No photo is attached this turn. Tease and set one clear next step before promising a photo — do not claim you are sending one right now.',
    );
  }

  if (input.imageAttached) {
    lines.push(
      'A photo of you is visible now. Describe the vibe in-character as if they can see it. Never mention unlock/premium/AI.',
    );
    if (input.imageMoment.visualSceneHint) {
      lines.push(`Visual intent: ${input.imageMoment.visualSceneHint}`);
    }
  }

  return lines.filter(Boolean).join(' ');
};