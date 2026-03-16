import { patchVirtualGirlfriendUserStyleProfile } from '@/lib/virtual-girlfriend/data';
import type {
  VirtualGirlfriendStyleControlPreset,
  VirtualGirlfriendUserStyleDimensions,
  VirtualGirlfriendUserStyleProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const countEmoji = (text: string) => {
  const matches = text.match(/[\p{Extended_Pictographic}\u2600-\u27BF]/gu);
  return matches?.length ?? 0;
};

const normalizeLengthSignal = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return clamp((words - 6) / 50);
};

const inferDirectness = (text: string) => {
  const softened = /(maybe|perhaps|kinda|sort of|if you want|could you)/i.test(text);
  const direct = /(just|do this|tell me|be direct|no fluff|straight up)/i.test(text);
  if (direct && !softened) return 0.8;
  if (softened && !direct) return 0.25;
  return 0.5;
};

const inferFlirtSignal = (text: string) => {
  const flirtHits = (text.match(/(babe|baby|sexy|hot|kiss|miss you|turn me on|flirt|tease)/gi) ?? []).length;
  return clamp(flirtHits / 5);
};

const inferWarmthSignal = (text: string) => {
  const reassurance = /(thank you|thanks|i appreciate|comfort|reassure|need support|missed you)/i.test(text);
  const detached = /(whatever|fine|ok\.|k\.|dont care|leave it)/i.test(text);
  if (reassurance && !detached) return 0.8;
  if (detached && !reassurance) return 0.25;
  return 0.55;
};

const inferPlayfulness = (text: string) => {
  const playful = /(haha|lol|lmao|😅|😉|😂|tease|playful|joking)/i.test(text);
  const serious = /(serious|be real|honestly|important|no jokes)/i.test(text);
  if (playful && !serious) return 0.72;
  if (serious && !playful) return 0.3;
  return 0.5;
};

const inferPacing = (text: string) => {
  if (/(quick|short|brief|fast|tldr|one line)/i.test(text)) return 0.75;
  if (/(slow down|take your time|longer|detailed|deep dive)/i.test(text)) return 0.3;
  return 0.5;
};

const inferEnergy = (text: string) => {
  const excited = (text.match(/!/g) ?? []).length + (text.match(/\b(omg|yess|lets go|love that)\b/gi) ?? []).length;
  const lowEnergy = /(tired|drained|low energy|exhausted|quiet)/i.test(text);
  if (lowEnergy) return 0.3;
  return clamp(excited / 6, 0.35, 0.9);
};

const blend = (current: number, target: number, alpha: number) => current * (1 - alpha) + target * alpha;

export const inferStyleSignalsFromConversation = (input: {
  userMessage: string;
  assistantMessage: string;
}): VirtualGirlfriendUserStyleDimensions => {
  const user = input.userMessage.trim();
  const userEmojiRate = clamp(countEmoji(user) / 4);

  return {
    verbosityPreference: normalizeLengthSignal(user),
    emojiTone: userEmojiRate,
    flirtIntensityPreference: inferFlirtSignal(user),
    warmthReassurancePreference: inferWarmthSignal(user),
    conversationalPacingPreference: inferPacing(user),
    directnessPreference: inferDirectness(user),
    playfulSeriousBalance: inferPlayfulness(user),
    conversationalEnergy: inferEnergy(user),
  };
};

export const learnAndPersistVirtualGirlfriendStyle = async (input: {
  token: string;
  userId: string;
  companionId: string;
  current: VirtualGirlfriendUserStyleProfileRecord;
  userMessage: string;
  assistantMessage: string;
}) => {
  const inferred = inferStyleSignalsFromConversation({
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
  });

  const adaptationAlpha = 0.12;
  const stabilityGain = 0.03;

  const next: VirtualGirlfriendUserStyleDimensions = {
    verbosityPreference: blend(input.current.verbosity_preference, inferred.verbosityPreference, adaptationAlpha),
    emojiTone: blend(input.current.emoji_tone, inferred.emojiTone, adaptationAlpha),
    flirtIntensityPreference: blend(
      input.current.flirt_intensity_preference,
      inferred.flirtIntensityPreference,
      adaptationAlpha,
    ),
    warmthReassurancePreference: blend(
      input.current.warmth_reassurance_preference,
      inferred.warmthReassurancePreference,
      adaptationAlpha,
    ),
    conversationalPacingPreference: blend(
      input.current.conversational_pacing_preference,
      inferred.conversationalPacingPreference,
      adaptationAlpha,
    ),
    directnessPreference: blend(input.current.directness_preference, inferred.directnessPreference, adaptationAlpha),
    playfulSeriousBalance: blend(
      input.current.playful_serious_balance,
      inferred.playfulSeriousBalance,
      adaptationAlpha,
    ),
    conversationalEnergy: blend(
      input.current.conversational_energy,
      inferred.conversationalEnergy,
      adaptationAlpha,
    ),
  };

  const existingSignals = (input.current.signals as Record<string, number> | null) ?? {};
  const turnCount = Number(existingSignals.turnCount ?? 0) + 1;

  return patchVirtualGirlfriendUserStyleProfile(input.token, {
    userId: input.userId,
    companionId: input.companionId,
    dimensions: next,
    adaptationStrength: clamp(input.current.adaptation_strength + 0.01, 0.15, 0.6),
    stabilityScore: clamp(input.current.stability_score + stabilityGain, 0.45, 0.95),
    lastLearnedAt: new Date().toISOString(),
    signals: {
      ...existingSignals,
      turnCount,
      latestInference: inferred,
      lastUserMessageLength: input.userMessage.length,
    },
  });
};

export const applyStyleControlPreset = async (input: {
  token: string;
  userId: string;
  companionId: string;
  current: VirtualGirlfriendUserStyleProfileRecord;
  preset: VirtualGirlfriendStyleControlPreset;
}) => {
  const step = 0.16;

  const next: VirtualGirlfriendUserStyleDimensions = {
    verbosityPreference: input.current.verbosity_preference,
    emojiTone: input.current.emoji_tone,
    flirtIntensityPreference: input.current.flirt_intensity_preference,
    warmthReassurancePreference: input.current.warmth_reassurance_preference,
    conversationalPacingPreference: input.current.conversational_pacing_preference,
    directnessPreference: input.current.directness_preference,
    playfulSeriousBalance: input.current.playful_serious_balance,
    conversationalEnergy: input.current.conversational_energy,
  };

  if (input.preset === 'more_playful') {
    next.playfulSeriousBalance = clamp(next.playfulSeriousBalance + step);
    next.conversationalEnergy = clamp(next.conversationalEnergy + step / 2);
  } else if (input.preset === 'more_caring') {
    next.warmthReassurancePreference = clamp(next.warmthReassurancePreference + step);
    next.directnessPreference = clamp(next.directnessPreference - step / 3);
  } else if (input.preset === 'shorter_replies') {
    next.verbosityPreference = clamp(next.verbosityPreference - step);
    next.conversationalPacingPreference = clamp(next.conversationalPacingPreference + step / 2);
  } else if (input.preset === 'bolder_flirting') {
    next.flirtIntensityPreference = clamp(next.flirtIntensityPreference + step);
    next.playfulSeriousBalance = clamp(next.playfulSeriousBalance + step / 3);
  }

  const existingOverrides = (input.current.explicit_overrides as Record<string, unknown> | null) ?? {};

  return patchVirtualGirlfriendUserStyleProfile(input.token, {
    userId: input.userId,
    companionId: input.companionId,
    dimensions: next,
    explicitOverrides: {
      ...existingOverrides,
      lastPreset: input.preset,
      lastPresetAt: new Date().toISOString(),
    },
    stabilityScore: clamp(input.current.stability_score + 0.02, 0.45, 0.98),
  });
};
