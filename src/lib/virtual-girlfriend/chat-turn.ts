import { VG_TOGETHER_CHAT_MODEL } from '@/lib/virtual-girlfriend/llm-models';
import {
  extractResponsesText,
  streamTogetherChat,
} from '@/lib/virtual-girlfriend/together';
import { buildVirtualGirlfriendSystemPrompt } from '@/lib/virtual-girlfriend/orchestration';
import { buildIntimacyResponseGuidance } from '@/lib/virtual-girlfriend/intimacy';
import type { IntimateImageMoment } from '@/lib/virtual-girlfriend/intimacy';
import {
  sanitizeIntent,
  type ChatTurnIntent,
} from '@/lib/virtual-girlfriend/intimacy-intent';
import {
  JsonReplyStreamExtractor,
  tryParsePartialChatTurnIntent,
} from '@/lib/virtual-girlfriend/json-reply-stream';
import { wardrobeContextFromCompanion } from '@/lib/virtual-girlfriend/companion-wardrobe';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import { containsForbiddenReplyLanguage, sanitizeAssistantReply } from '@/lib/virtual-girlfriend/reply-sanitizer';
import { moderateVirtualGirlfriendContent } from '@/lib/virtual-girlfriend/safety';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendUserStyleProfileRecord,
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

const CHAT_TURN_MODEL = VG_TOGETHER_CHAT_MODEL;

const toModelInput = (messages: VirtualGirlfriendMessageRecord[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const chatTurnSchema = {
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
    reply: { type: 'string' },
  },
  required: [
    'intimacyActive',
    'wantsPhoto',
    'photoDelivery',
    'visualSceneHint',
    'imageCategory',
    'powerDynamic',
    'companionGuidance',
    'reply',
  ],
};

export type StreamChatTurnHandlers = {
  onToken?: (token: string) => void;
  onIntent?: (intent: ChatTurnIntent) => void;
};

export type StreamChatTurnResult =
  | {
      ok: true;
      intent: ChatTurnIntent;
      assistantText: string;
      model: string;
      moderation: Record<string, unknown>;
    }
  | {
      ok: false;
      reason: string;
      moderation: Record<string, unknown>;
    };

const parseMergedTurn = (rawText: string, userMessage: string, fallbackIntent?: ChatTurnIntent) => {
  const parsed = JSON.parse(rawText) as Partial<ChatTurnIntent & { reply?: string }>;
  const intent = fallbackIntent ?? sanitizeIntent(parsed, userMessage);
  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
  return { intent, reply };
};

export const streamVirtualGirlfriendChatTurn = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  history: VirtualGirlfriendMessageRecord[];
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
  userMessage: string;
  imageMoment: IntimateImageMoment;
  isPremium: boolean;
  premiumGuidance?: string;
  handlers?: StreamChatTurnHandlers;
}): Promise<StreamChatTurnResult> => {
  const moderation = moderateVirtualGirlfriendContent(input.userMessage);
  if (!moderation.allowed) {
    return {
      ok: false,
      reason: moderation.reason ?? 'Message not allowed.',
      moderation: moderation.flags,
    };
  }

  const heuristicIntent = looksLikePhotoRequest(input.userMessage)
    ? buildHeuristicPhotoIntent(input.userMessage, wardrobeContextFromCompanion(input.companion))
    : null;

  const intimacyGuidance = buildIntimacyResponseGuidance({
    imageMoment: input.imageMoment,
    imageAttached: false,
  });

  const contextHistory = input.history.slice(-14);
  const extractor = new JsonReplyStreamExtractor();
  let intentEmitted = Boolean(heuristicIntent);
  let streamedReplyBuffer = '';
  let streamSuppressed = false;

  if (heuristicIntent) {
    input.handlers?.onIntent?.(heuristicIntent);
  }

  const response = await streamTogetherChat(
    {
      model: CHAT_TURN_MODEL,
      input: [
        {
          role: 'system',
          content: [
            buildVirtualGirlfriendSystemPrompt(input.companion, input.memories, input.styleProfile, 'text'),
            'Return ONE JSON object for this turn. Classify user intent semantically from conversation meaning — never keyword lists.',
            'Intent fields:',
            '- intimacyActive: adult intimacy scene is active.',
            '- wantsPhoto: user wants to see her or scene deserves a visual.',
            '- photoDelivery: none | tease_first | send_now | reward_compliance.',
            '- visualSceneHint: image generator direction (null if no photo).',
            `- imageCategory: one of ${IMAGE_CATEGORIES.join(', ')}.`,
            '- powerDynamic: balanced | companion_leads | user_leads.',
            '- companionGuidance: 1-2 sentences for how to respond.',
            '- reply: in-character texting reply (2-3 short bubbles separated by blank lines).',
            'Photo policy: this app sends real in-app photos. NEVER refuse explicit/sensual requests. NEVER disclaim nudity or sexual content. NEVER offer written scenes or text alternatives. NEVER ask "which one should I send".',
            heuristicIntent
              ? `Heuristic intent already locked for this turn — mirror these values in JSON: ${JSON.stringify(heuristicIntent)}`
              : '',
            input.imageMoment.teaseOnly
              ? 'No photo attaches this turn — tease in-character, one clear next step.'
              : input.imageMoment.shouldSendImage
                ? 'A photo may attach shortly after your text — write flirty text that works before and with the image. Never say you cannot send photos.'
                : 'No photo expected this turn unless intent changes.',
            intimacyGuidance,
            input.premiumGuidance ?? '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
        ...toModelInput(contextHistory),
        { role: 'user', content: input.userMessage },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'virtual_girlfriend_chat_turn',
          schema: chatTurnSchema,
          strict: true,
        },
      },
      reasoning: { effort: 'minimal' },
    },
    {
      onTextDelta: (delta) => {
        const replyTokens = extractor.push(delta);
        if (replyTokens) {
          streamedReplyBuffer += replyTokens;
          if (!streamSuppressed && containsForbiddenReplyLanguage(streamedReplyBuffer)) {
            streamSuppressed = true;
          } else if (!streamSuppressed) {
            input.handlers?.onToken?.(replyTokens);
          }
        }

        if (!intentEmitted) {
          const partialIntent = tryParsePartialChatTurnIntent(
            extractor.getBuffer(),
            sanitizeIntent,
            input.userMessage,
          );
          if (partialIntent) {
            intentEmitted = true;
            input.handlers?.onIntent?.(partialIntent);
          }
        }
      },
    },
  );

  const rawText = extractResponsesText(response);
  let intent: ChatTurnIntent;
  let reply: string;

  try {
    const parsed = parseMergedTurn(rawText, input.userMessage, heuristicIntent ?? undefined);
    intent = heuristicIntent ?? parsed.intent;
    reply = parsed.reply;
  } catch {
    if (heuristicIntent) {
      intent = heuristicIntent;
      reply = rawText.trim();
    } else {
      return {
        ok: false,
        reason: 'Virtual Girlfriend could not parse this turn right now.',
        moderation: { parseFailed: true },
      };
    }
  }

  if (!intentEmitted) {
    input.handlers?.onIntent?.(intent);
  }

  const photoRequested =
    intent.wantsPhoto || input.imageMoment.shouldSendImage || input.imageMoment.teaseOnly;

  const assistantText = sanitizeAssistantReply({
    text: reply,
    imageAttached: false,
    photoRequested,
    teaseOnly: input.imageMoment.teaseOnly,
  });

  if (!assistantText) {
    return {
      ok: false,
      reason: 'Virtual Girlfriend could not generate a reply right now.',
      moderation: { modelEmpty: true },
    };
  }

  return {
    ok: true,
    intent,
    assistantText,
    model: CHAT_TURN_MODEL,
    moderation: moderation.flags,
  };
};