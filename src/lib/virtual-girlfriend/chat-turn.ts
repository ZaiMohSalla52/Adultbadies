import { VG_CHAT_HISTORY_WINDOW } from '@/lib/virtual-girlfriend/chat-config';
import { VG_CHAT_MODEL } from '@/lib/virtual-girlfriend/llm-models';
import {
  extractResponsesText,
  streamTogetherChat,
} from '@/lib/virtual-girlfriend/llm-provider';
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
import {
  dedupeMessageSegments,
  isNearDuplicateAssistantReply,
  splitAssistantReplyIntoSegments,
} from '@/lib/virtual-girlfriend/message-segments';
import { wardrobeContextFromCompanion } from '@/lib/virtual-girlfriend/companion-wardrobe';
import { buildHeuristicPhotoIntent, looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';
import {
  containsForbiddenReplyLanguage,
  polishChatDisplayText,
  sanitizeAssistantReply,
} from '@/lib/virtual-girlfriend/reply-sanitizer';
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

const CHAT_TURN_MODEL = VG_CHAT_MODEL;

const toModelInput = (messages: VirtualGirlfriendMessageRecord[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const chatTurnSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    intimacyActive: { type: 'boolean' },
    wantsPhoto: { type: 'boolean' },
    photoDelivery: { type: 'string', enum: ['none', 'tease_first', 'send_now', 'reward_compliance'] },
    visualSceneHint: { type: ['string', 'null'] },
    imageCategory: { type: 'string', enum: IMAGE_CATEGORIES },
    powerDynamic: { type: 'string', enum: ['balanced', 'companion_leads', 'user_leads'] },
    companionGuidance: { type: 'string' },
  },
  required: [
    'reply',
    'intimacyActive',
    'wantsPhoto',
    'photoDelivery',
    'visualSceneHint',
    'imageCategory',
    'powerDynamic',
    'companionGuidance',
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
  const rawReply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
  const reply = dedupeMessageSegments(splitAssistantReplyIntoSegments(rawReply)).join('\n\n');
  return { intent, reply };
};

const buildTurnSystemPrompt = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
  userMessage: string;
  imageMoment: IntimateImageMoment;
  isPremium: boolean;
  premiumGuidance?: string;
  heuristicIntent: ChatTurnIntent | null;
  lastAssistantMessage?: string;
  antiRepeat?: boolean;
}) => {
  const resolvedName = input.companion.structured_profile?.name?.trim() || input.companion.name;

  return [
    buildVirtualGirlfriendSystemPrompt(input.companion, input.memories, input.styleProfile),
    `Identity lock: your name is ${resolvedName}. Never introduce yourself with a different name unless the user explicitly gave you an approved nickname for this chat.`,
    'Return ONE JSON object for this turn. Emit reply as the FIRST JSON field so the user sees text immediately, then fill intent fields.',
    'Classify user intent semantically from conversation meaning — never keyword lists.',
    'Never repeat your previous assistant message verbatim or with only tiny edits. Each turn must advance the conversation with fresh wording.',
    'Each bubble inside reply must be unique — do not paste the same sentence twice in one reply.',
    'In reply: plain texting voice — no markdown (**bold**), no meta actions (*photosending*, *sends photo*, *smirks*). The app handles images silently; never narrate uploading or sending.',
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
    input.heuristicIntent
      ? `Heuristic intent already locked for this turn — mirror these values in JSON: ${JSON.stringify(input.heuristicIntent)}`
      : '',
    input.imageMoment.teaseOnly
      ? 'No photo attaches this turn — tease in-character, one clear next step.'
      : input.imageMoment.shouldSendImage
        ? 'A photo will attach automatically after your text — write flirty in-character reply only. Do NOT mention sending/uploading photos or use *photosending*.'
        : 'No photo expected this turn unless intent changes.',
    buildIntimacyResponseGuidance({
      imageMoment: input.imageMoment,
      imageAttached: false,
    }),
    input.premiumGuidance ?? '',
    input.lastAssistantMessage
      ? `Previous assistant message (do NOT repeat): "${input.lastAssistantMessage.slice(0, 280)}"`
      : '',
    input.antiRepeat
      ? 'CRITICAL: Your last attempt repeated the previous message. Write a clearly different reply that directly answers the latest user message.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const runChatTurnRequest = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  history: VirtualGirlfriendMessageRecord[];
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
  userMessage: string;
  imageMoment: IntimateImageMoment;
  isPremium: boolean;
  premiumGuidance?: string;
  heuristicIntent: ChatTurnIntent | null;
  lastAssistantMessage?: string;
  antiRepeat?: boolean;
  handlers?: StreamChatTurnHandlers;
}) => {
  const contextHistory = input.history.slice(-VG_CHAT_HISTORY_WINDOW);
  const extractor = new JsonReplyStreamExtractor();
  let intentEmitted = Boolean(input.heuristicIntent);
  let streamedReplyBuffer = '';
  let streamSuppressed = false;

  if (input.heuristicIntent) {
    input.handlers?.onIntent?.(input.heuristicIntent);
  }

  const response = await streamTogetherChat(
    {
      model: CHAT_TURN_MODEL,
      input: [
        {
          role: 'system',
          content: buildTurnSystemPrompt(input),
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

  return { response, intentEmitted };
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

  const lastAssistantMessage = [...input.history].reverse().find((message) => message.role === 'assistant')?.content?.trim();

  const turnRequestBase = {
    companion: input.companion,
    history: input.history,
    memories: input.memories,
    styleProfile: input.styleProfile,
    userMessage: input.userMessage,
    imageMoment: input.imageMoment,
    isPremium: input.isPremium,
    premiumGuidance: input.premiumGuidance,
    heuristicIntent,
    lastAssistantMessage,
    handlers: input.handlers,
  };

  let { response, intentEmitted } = await runChatTurnRequest(turnRequestBase);

  let rawText = extractResponsesText(response);
  let intent!: ChatTurnIntent;
  let reply = '';

  try {
    const parsed = parseMergedTurn(rawText, input.userMessage, heuristicIntent ?? undefined);
    intent = heuristicIntent ?? parsed.intent;
    reply = parsed.reply;

    if (lastAssistantMessage && isNearDuplicateAssistantReply(reply, lastAssistantMessage)) {
      const retriedTurn = await runChatTurnRequest({
        ...turnRequestBase,
        antiRepeat: true,
        handlers: undefined,
      });
      response = retriedTurn.response;
      intentEmitted = intentEmitted || retriedTurn.intentEmitted;
      rawText = extractResponsesText(response);
      const retried = parseMergedTurn(rawText, input.userMessage, heuristicIntent ?? undefined);
      intent = heuristicIntent ?? retried.intent;
      reply = retried.reply;
    }
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