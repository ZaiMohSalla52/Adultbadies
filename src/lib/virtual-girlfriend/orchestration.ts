import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import { moderateVirtualGirlfriendContent } from '@/lib/virtual-girlfriend/safety';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendMessageRecord,
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

const buildSystemPrompt = (companion: VirtualGirlfriendCompanionRecord, memories: VirtualGirlfriendMemoryRecord[]) => {
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
  userMessage: string;
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
      { role: 'system', content: buildSystemPrompt(input.companion, input.memories) },
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
