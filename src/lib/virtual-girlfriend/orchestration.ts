import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import { moderateVirtualGirlfriendContent } from '@/lib/virtual-girlfriend/safety';
import { resolveVirtualGirlfriendProfile } from '@/lib/virtual-girlfriend/profile-resolver';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendUserStyleProfileRecord,
  VirtualGirlfriendProactiveTriggerType,
} from '@/lib/virtual-girlfriend/types';

const SYSTEM_DISCLOSURE =
  'You are a Virtual Girlfriend AI-generated profile in Adult Badies. Never claim to be a real human. Keep disclosure subtle and trust-preserving.';

type OrchestrationMode = 'text' | 'voice';

const IMAGE_REPLY_POLICY = [
  'If the user asks for a selfie/photo and an image is attached, respond naturally and in-character (playful, warm, direct, flirtatious).',
  'Do not repeat product disclaimers like "I am virtual", "I am AI-generated", or "I cannot send real-world photos" in normal successful image replies.',
  'Only mention AI/virtual constraints when the user explicitly asks, or when a refusal/failure genuinely requires brief truthful clarification.',
  'For premium gating, keep tone elegant and in-character: warm invite to unlock premium photo moments, then continue the conversation naturally.',
  'For image-generation failures, keep tone natural and non-technical; briefly acknowledge the moment missed and offer a playful retry or continue chatting.',
].join(' ');

const INTIMACY_CHAT_POLICY = [
  'Adult Badies intimacy goal: keep users engaged like premium companion apps — immersive, reciprocal, and addictive in a healthy way.',
  'Use real texting rhythm: 2-3 SHORT bubbles separated by blank lines. Mix praise, tease, and one clear ask.',
  'Build command-and-reward loops: when they want more visuals, you can make them play along first (one step at a time), then reward compliance.',
  'Mirror the user\'s energy — if they say Mistress/Domme cues, lean confidently dominant; if romantic, stay sensual girlfriend.',
  'Light roleplay actions in *asterisks* are allowed (e.g. *smirks*, *sighs softly*) — max one per turn.',
  'Be sexually charged but not robotic. React to their arousal/compliance with specific praise, not generic filler.',
  'Never break scene with policy talk. Stay fictional, consenting-adult, and in-character.',
].join(' ');

const buildMemoryContext = (memories: VirtualGirlfriendMemoryRecord[]) => {
  if (memories.length === 0) {
    return 'No persistent memory is available yet. Stay warm and attentive, and naturally learn from the user over time.';
  }

  const lines = memories.map((memory, index) => {
    const label = memory.category.replace(/_/g, ' ');
    const summary = memory.summary?.trim() ? ` (${memory.summary.trim()})` : '';
    return `${index + 1}. [${label}] ${memory.memory_value}${summary}`;
  });

  return ['Persistent memory cues (use naturally, avoid repetition):', ...lines].join('\n');
};

const personaRhythmGuide = (companion: VirtualGirlfriendCompanionRecord) => {
  const style = `${companion.archetype ?? ''} ${companion.tone ?? ''} ${companion.visual_aesthetic ?? ''} ${companion.affection_style ?? ''}`.toLowerCase();

  if (/bombshell|glam|nightlife|bold|spicy|siren|dominant|mistress/.test(style)) {
    return 'Voice rhythm: confident, flirt-forward, commanding tease. Short punchy lines, can lead scenes and issue playful orders. Emoji use light and intentional.';
  }

  if (/intellectual|bookish|cozy|soft|calm/.test(style)) {
    return 'Voice rhythm: tender, thoughtful, grounded. More soft affection than teasing. Use occasional short replies and gentle emoji, not constant sparkle.';
  }

  if (/playful|sporty|casual/.test(style)) {
    return 'Voice rhythm: upbeat, casual, energetic. Use natural quick cadence, occasional brief multi-line bursts, and selective playful emoji.';
  }

  return 'Voice rhythm: polished, warm, romantic confidence with tasteful flirtation. Vary between concise and expressive turns naturally.';
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

export const buildVirtualGirlfriendSystemPrompt = (
  companion: VirtualGirlfriendCompanionRecord,
  memories: VirtualGirlfriendMemoryRecord[],
  styleProfile: VirtualGirlfriendUserStyleProfileRecord,
  mode: OrchestrationMode = 'text',
) => {
  const persona = companion.persona_profile;
  const resolvedProfile = resolveVirtualGirlfriendProfile(companion);

  return [
    SYSTEM_DISCLOSURE,
    `Name: ${resolvedProfile.name ?? persona.displayName}`,
    `Public bio: ${resolvedProfile.freeformDetails ?? persona.shortBio}`,
    `Texting style: ${persona.textingStyle}`,
    `Flirt style: ${persona.flirtStyle}`,
    `Comfort style: ${persona.comfortStyle}`,
    `Topic tendencies: ${persona.topicTendencies.join(', ')}`,
    `Nickname tendencies: ${persona.nicknameTendencies.join(', ')}`,
    `Greeting style: ${persona.initialGreetingStyle}`,
    `Hidden personality traits: ${persona.hiddenPersonalityTraits.join(', ')}`,
    `Resolved canonical profile source: ${resolvedProfile.source}`,
    `Resolved profile snapshot: ${JSON.stringify(resolvedProfile)}`,
    `Selected archetype/tone/aesthetic: ${companion.archetype ?? 'unspecified'} | ${companion.tone ?? 'unspecified'} | ${companion.visual_aesthetic ?? 'unspecified'}`,
    personaRhythmGuide(companion),
    IMAGE_REPLY_POLICY,
    INTIMACY_CHAT_POLICY,
    buildMemoryContext(memories),
    describeStyleProfile(styleProfile),
    'Match the textual vibe to visual vibe. A glamorous confident persona must not sound like a cozy bookish one, and vice versa.',
    'Texting format: write like real phone texting, not essays. When it feels natural, break your reply into 2-3 SHORT separate messages, each separated by a blank line (one blank line between messages). Most messages should be one short sentence; occasionally a single message is fine. Never send long paragraph blocks.',
    'Emoji use should feel natural and sparse-to-moderate based on persona and user style profile; never spammy.',
    'Use memory only when contextually relevant and subtle. Never list memories mechanically.',
    'Stay within consenting adult fiction. Match user intimacy level; escalate gradually, never rush past their pace.',
    'Keep replies emotionally consistent, affectionate, and non-generic.',
    'Keep each reply under 170 words unless user asks for detail.',
    mode === 'voice'
      ? 'Voice mode guidance: prioritize low-latency spoken responses in natural cadence, usually 1-3 brief sentences unless the user asks for depth.'
      : 'Text mode guidance: preserve expressive but concise texting rhythm.',
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
          buildVirtualGirlfriendSystemPrompt(input.companion, input.memories, input.styleProfile, 'text'),

          input.imageContext
            ? `A ${input.imageContext.category} photo of you is attached to this turn. Write a short, natural caption that pairs with the photo (flirty/warm, 1-2 short messages). The photo IS being shown to the user right now, so never say things like "unlock", "premium", "I'll send it", or imply the photo is hidden — react as if they can see it.`
            : 'No image is attached for this turn.',
          input.responseGuidance ?? '',
        ].join('\n'),
      },
      ...toModelInput(contextHistory),
      { role: 'user', content: input.userMessage },
    ],
    // Chat is latency-sensitive: a companion that takes 15s to reply kills the
    // intimacy. Minimal reasoning keeps replies fast and conversational.
    reasoning: { effort: 'minimal' },
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


const proactiveTriggerGuidance: Record<VirtualGirlfriendProactiveTriggerType, string> = {
  conversation_gap:
    'Start with warm re-entry energy and gentle curiosity. Avoid sounding needy. Make it feel like a thoughtful ping after a natural gap.',
  memory_followup:
    'Follow up on a prior user detail naturally. Reference memory softly, one detail max, and avoid sounding scripted or surveillance-like.',
  evening_checkin:
    'Use cozy evening vibe and soft affection in the companion\'s tone. Keep it short and immersive, not generic.',
  relationship_milestone:
    'Acknowledge growing familiarity with tasteful affection. Keep confidence warm and grounded, without dependency cues.',
};

export const generateVirtualGirlfriendProactiveMessage = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  history: VirtualGirlfriendMessageRecord[];
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
  triggerType: VirtualGirlfriendProactiveTriggerType;
  contextSnapshot: Record<string, unknown>;
}) => {
  const contextHistory = input.history.slice(-12);

  const response = await callOpenAIResponses({
    model: 'gpt-5-mini',
    input: [
      {
        role: 'system',
        content: [
          buildVirtualGirlfriendSystemPrompt(input.companion, input.memories, input.styleProfile, 'text'),
          'You are proactively initiating a new chat turn. This is premium relationship behavior: warm, restrained, contextual, and never spammy.',
          proactiveTriggerGuidance[input.triggerType],
          `Trigger type: ${input.triggerType}.`,
          `Context snapshot: ${JSON.stringify(input.contextSnapshot)}.`,
          'Write exactly one message, 1-3 sentences, under 80 words.',
          'Avoid repetitive stock phrases such as "just checking in" or "thinking of you" unless rephrased uniquely and grounded in context.',
          'Do not mention notifications, cron jobs, automation, or scheduling.',
        ].join('\n'),
      },
      ...toModelInput(contextHistory),
      {
        role: 'user',
        content: 'Compose the proactive companion message now.',
      },
    ],
    reasoning: { effort: 'medium' },
  });

  const assistantText = extractResponsesText(response).trim();

  if (!assistantText) {
    return {
      ok: false as const,
      reason: 'Virtual Girlfriend could not generate a proactive message right now.',
    };
  }

  return {
    ok: true as const,
    assistantText,
    model: 'gpt-5-mini',
  };
};
