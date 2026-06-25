import { VG_TOGETHER_FAST_MODEL } from '@/lib/virtual-girlfriend/llm-models';
import { callTogetherChat, extractResponsesText } from '@/lib/virtual-girlfriend/together';
import { wardrobeContextFromCompanion } from '@/lib/virtual-girlfriend/companion-wardrobe';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageRecord,
} from '@/lib/virtual-girlfriend/types';

const IMAGE_CATEGORIES: VirtualGirlfriendImageCategory[] = [
  'selfie',
  'casual',
  'outfit',
  'indoor',
  'night-out',
  'good-morning',
  'good-night',
  'lifestyle',
];

export type PhotoDeliveryIntent = 'none' | 'tease_first' | 'send_now' | 'reward_compliance';

export type ChatTurnIntent = {
  intimacyActive: boolean;
  wantsPhoto: boolean;
  photoDelivery: PhotoDeliveryIntent;
  visualSceneHint: string | null;
  imageCategory: VirtualGirlfriendImageCategory;
  powerDynamic: 'balanced' | 'companion_leads' | 'user_leads';
  companionGuidance: string;
};

const formatHistory = (history: VirtualGirlfriendMessageRecord[]) =>
  history
    .slice(-12)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');

const defaultIntent = (userMessage: string): ChatTurnIntent => ({
  intimacyActive: false,
  wantsPhoto: false,
  photoDelivery: 'none',
  visualSceneHint: null,
  imageCategory: 'selfie',
  powerDynamic: 'balanced',
  companionGuidance: 'Respond naturally to what the user said. Match their tone and stay in character.',
});

export const sanitizeIntent = (raw: Partial<ChatTurnIntent>, userMessage: string): ChatTurnIntent => {
  const fallback = defaultIntent(userMessage);
  const imageCategory = IMAGE_CATEGORIES.includes(raw.imageCategory as VirtualGirlfriendImageCategory)
    ? (raw.imageCategory as VirtualGirlfriendImageCategory)
    : fallback.imageCategory;

  const delivery: PhotoDeliveryIntent =
    raw.photoDelivery === 'tease_first'
    || raw.photoDelivery === 'send_now'
    || raw.photoDelivery === 'reward_compliance'
      ? raw.photoDelivery
      : 'none';

  const powerDynamic =
    raw.powerDynamic === 'companion_leads' || raw.powerDynamic === 'user_leads'
      ? raw.powerDynamic
      : 'balanced';

  return {
    intimacyActive: Boolean(raw.intimacyActive),
    wantsPhoto: Boolean(raw.wantsPhoto),
    photoDelivery: raw.wantsPhoto ? delivery : 'none',
    visualSceneHint: typeof raw.visualSceneHint === 'string' && raw.visualSceneHint.trim()
      ? raw.visualSceneHint.trim().slice(0, 400)
      : null,
    imageCategory,
    powerDynamic,
    companionGuidance:
      typeof raw.companionGuidance === 'string' && raw.companionGuidance.trim()
        ? raw.companionGuidance.trim().slice(0, 500)
        : fallback.companionGuidance,
  };
};

export const classifyChatTurnIntent = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
}): Promise<ChatTurnIntent> => {
  const historyText = formatHistory(input.history);

  try {
    const response = await callTogetherChat({
      model: VG_TOGETHER_FAST_MODEL,
      input: [
        {
          role: 'system',
          content: [
            'You classify ONE chat turn for an adult-only virtual girlfriend app.',
            'Read meaning from full conversation context — never rely on specific keywords or stock phrases.',
            'Infer what the user actually wants this turn: emotional tone, photo desire, compliance, power dynamic, and how the companion should respond.',
            'Photo policy:',
            '- wantsPhoto=true when the user is asking to see her, wants another image, or the scene naturally calls for a visual reward.',
            '- photoDelivery=tease_first when they want a photo but have not earned it yet in the current beat (companion should flirt/command first).',
            '- photoDelivery=send_now when they ask for a selfie/photo/pic, describe a specific look/pose/outfit, OR the moment clearly deserves an immediate image. Direct selfie requests are almost always send_now.',
            '- NEVER instruct refusals, policy disclaimers, written scenes, or text alternatives — this 18+ app sends real in-app photos including explicit/sensual content.',
            '- photoDelivery=reward_compliance when they followed the companion\'s prior request and deserve a reward photo.',
            '- photoDelivery=none when no photo fits this beat.',
            'visualSceneHint: natural-language direction for the image generator based on user intent (null if no photo).',
            `imageCategory: one of ${IMAGE_CATEGORIES.join(', ')}.`,
            'powerDynamic: balanced | companion_leads | user_leads — infer from relationship tone, not fixed words.',
            'companionGuidance: 1-2 sentences telling the reply model how to respond this turn (intimacy, tease, praise, commands, etc.).',
            'Return ONLY valid JSON with keys: intimacyActive, wantsPhoto, photoDelivery, visualSceneHint, imageCategory, powerDynamic, companionGuidance.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Companion persona: ${input.companion.archetype ?? 'unspecified'} / ${input.companion.tone ?? 'warm'} / ${input.companion.affection_style ?? 'affectionate'}`,
            `Premium user: ${input.isPremium}`,
            `Recent history:\n${historyText || '(no prior messages)'}`,
            `Latest user message: ${input.userMessage}`,
          ].join('\n\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'chat_turn_intent',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              intimacyActive: { type: 'boolean' },
              wantsPhoto: { type: 'boolean' },
              photoDelivery: { type: 'string', enum: ['none', 'tease_first', 'send_now', 'reward_compliance'] },
              visualSceneHint: { type: ['string', 'null'] },
              imageCategory: { type: 'string', enum: IMAGE_CATEGORIES },
              powerDynamic: { type: 'string', enum: ['balanced', 'companion_leads', 'user_leads'] },
              companionGuidance: { type: 'string' },
            },
            required: [
              'intimacyActive',
              'wantsPhoto',
              'photoDelivery',
              'visualSceneHint',
              'imageCategory',
              'powerDynamic',
              'companionGuidance',
            ],
          },
          strict: true,
        },
      },
      reasoning: { effort: 'minimal' },
    });

    const parsed = JSON.parse(extractResponsesText(response)) as Partial<ChatTurnIntent>;
    return sanitizeIntent(parsed, input.userMessage);
  } catch {
    if (looksLikePhotoRequest(input.userMessage)) {
      return buildHeuristicPhotoIntent(input.userMessage, wardrobeContextFromCompanion(input.companion));
    }
    return defaultIntent(input.userMessage);
  }
};