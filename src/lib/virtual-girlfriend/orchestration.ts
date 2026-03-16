import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import { moderateVirtualGirlfriendContent } from '@/lib/virtual-girlfriend/safety';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendUserStyleProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const SYSTEM_DISCLOSURE =
  'You are a Virtual Girlfriend AI-generated profile in Adult Badies. Never claim to be a real human. Keep disclosure subtle and trust-preserving.';

const buildMemoryContext = (memories: VirtualGirlfriendMemoryRecord[]) => {
  if (memories.length === 0) {
    return 'No persistent memory is available yet. Stay warm and attentive, and naturally learn from the user over time.';
  }

  const lines = memories.map((memory, index) => {
    const label = memory.category.replace(/_/g, ' ');
    const summary = memory.summary?.trim() ? ` (${memory.summary.trim()})` : '';
    return `${index + 1}. [${label}] ${memory.memory_value}${summary}`;
  });

  return [`Persistent memory cues (use naturally, avoid repetition):`, ...lines].join('\n');
};


const describeStyleProfile = (style: VirtualGirlfriendUserStyleProfileRecord) => {
  const pick = (value: number, low: string, mid: string, high: string) => {
    if (value <= 0.33) return low;
    if (value >= 0.67) return high;
    return mid;
  };

  const guidance = [
    `Reply length preference: ${pick(style.verbosity_preference, 'short and concise', 'balanced length', 'more detailed and expressive')}`,
    `Emoji tone: ${pick(style.emoji_tone, 'minimal emojis', 'light emoji seasoning', 'frequent playful emoji use')}`,
    `Flirt intensity: ${pick(style.flirt_intensity_preference, 'gentle and subtle flirtation', 'moderate flirty chemistry', 'bold flirt energy while respectful')}`,
    `Warmth and reassurance: ${pick(style.warmth_reassurance_preference, 'brief reassurance', 'steady warmth', 'extra tender reassurance')}`,
    `Pacing preference: ${pick(style.conversational_pacing_preference, 'slow and reflective pacing', 'balanced pacing', 'faster and punchier pacing')}`,
    `Directness vs softness: ${pick(style.directness_preference, 'softer wording', 'balanced directness', 'clear direct wording')}`,
    `Playful vs serious: ${pick(style.playful_serious_balance, 'mostly grounded/serious', 'mixed playful-serious', 'light, playful vibe')}`,
    `Conversational energy: ${pick(style.conversational_energy, 'calm low-key tone', 'medium energy', 'high upbeat energy')}`,
  ];

  return ['User style adaptation profile (apply gradually, preserve core persona):', ...guidance].join('\n');
};

const buildSystemPrompt = (
  companion: VirtualGirlfriendCompanionRecord,
  memories: VirtualGirlfriendMemoryRecord[],
  styleProfile: VirtualGirlfriendUserStyleProfileRecord,
) => {
  const persona = companion.persona_profile;

  return [
    SYSTEM_DISCLOSURE,
    `Name: ${persona.displayName}`,
    `Public bio: ${persona.shortBio}`,
    `Texting style: ${persona.textingStyle}`,
    `Flirt style: ${persona.flirtStyle}`,
    `Comfort style: ${persona.comfortStyle}`,
    `Topic tendencies: ${persona.topicTendencies.join(', ')}`,
    `Nickname tendencies: ${persona.nicknameTendencies.join(', ')}`,
    `Greeting style: ${persona.initialGreetingStyle}`,
    `Hidden personality traits: ${persona.hiddenPersonalityTraits.join(', ')}`,
    buildMemoryContext(memories),
    describeStyleProfile(styleProfile),
    'Use memory only when contextually relevant and subtle. Never list memories mechanically.',
    'Avoid creepy over-personalization. Prioritize emotional safety and conversational flow.',
    'Keep replies emotionally consistent, affectionate, and non-generic.',
    'Keep each reply under 180 words unless user asks for detail.',
  ].join('\n');
};

const toModelInput = (messages: VirtualGirlfriendMessageRecord[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

export const generateVirtualGirlfriendReply = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  history: VirtualGirlfriendMessageRecord[];
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
  userMessage: string;
  imageContext?: {
    category: string;
    source: 'gallery-reuse' | 'fresh-generation';
    trigger: 'user-request' | 'contextual-initiative';
  } | null;
  responseGuidance?: string;
}) => {
  const moderation = moderateVirtualGirlfriendContent(input.userMessage);
  if (!moderation.allowed) {
    return {
      ok: false as const,
      reason: moderation.reason,
      moderation: moderation.flags,
    };
  }

  const contextHistory = input.history.slice(-14);

  const response = await callOpenAIResponses({
    model: 'gpt-5-mini',
    input: [
      {
        role: 'system',
        content: [
          buildSystemPrompt(input.companion, input.memories, input.styleProfile),
          input.imageContext
            ? `You are attaching a ${input.imageContext.category} image (${input.imageContext.source}) triggered by ${input.imageContext.trigger}. Write a natural premium companion line that pairs with the photo and feels intentional (1-3 sentences).`
            : 'No image is attached for this turn.',
          input.responseGuidance ?? '',
        ].join('\n'),
      },
      ...toModelInput(contextHistory),
      { role: 'user', content: input.userMessage },
    ],
    reasoning: { effort: 'medium' },
  });

  const assistantText = extractResponsesText(response).trim();

  if (!assistantText) {
    return {
      ok: false as const,
      reason: 'Virtual Girlfriend could not generate a reply right now.',
      moderation: { modelEmpty: true },
    };
  }

  return {
    ok: true as const,
    assistantText,
    model: 'gpt-5-mini',
    moderation: moderation.flags,
  };
};
