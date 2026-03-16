import { upsertVirtualGirlfriendMemory } from '@/lib/virtual-girlfriend/data';
import type { VirtualGirlfriendMemoryCandidate, VirtualGirlfriendMemoryCategory } from '@/lib/virtual-girlfriend/types';

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 10)
    .join('_');

const buildCandidate = (
  category: VirtualGirlfriendMemoryCategory,
  keySeed: string,
  value: string,
  sourceRole: 'user' | 'assistant',
  importance: number,
  salience: number,
  confidence: number,
  summary?: string,
): VirtualGirlfriendMemoryCandidate | null => {
  const cleaned = value.trim();

  if (!cleaned || cleaned.length < 5) {
    return null;
  }

  const key = `${category}_${normalizeKey(keySeed)}`;

  return {
    key,
    category,
    value: cleaned.slice(0, 280),
    sourceRole,
    importance,
    salience,
    confidence,
    summary: summary?.slice(0, 160),
  };
};

const extractPreference = (text: string) => {
  const patterns = [
    /\b(?:i\s+(?:really\s+)?(?:like|love|enjoy|prefer))\s+([^.!?]{3,80})/i,
    /\bmy\s+favorite\s+([^.!?]{3,40})\s+is\s+([^.!?]{2,60})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match.slice(1).join(' ').replace(/\s+/g, ' ').trim();
      return buildCandidate('user_preference', `pref ${value}`, value, 'user', 4, 4, 0.85, 'User preference');
    }
  }

  return null;
};

const extractFact = (text: string) => {
  const patterns = [
    /\bi\s+work\s+as\s+([^.!?]{2,60})/i,
    /\bi\s+live\s+in\s+([^.!?]{2,60})/i,
    /\bmy\s+name\s+is\s+([^.!?]{2,40})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      return buildCandidate('user_fact', `fact ${value}`, value, 'user', 4, 3, 0.82, 'User fact');
    }
  }

  return null;
};

const extractEmotion = (text: string) => {
  const match = text.match(/\bi\s*(?:am|m|feel|feeling)\s+([^.!?]{3,80})/i);
  if (!match?.[1]) return null;

  const value = match[1].replace(/\s+/g, ' ').trim();
  const importance = /(sad|depressed|anxious|stressed|lonely|hurt)/i.test(value) ? 5 : 4;

  return buildCandidate('emotional_signal', `emotion ${value}`, value, 'user', importance, 4, 0.88, 'User emotional state');
};

const extractNickname = (text: string) => {
  const match = text.match(/\b(?:call\s+me|you\s+can\s+call\s+me)\s+([^.!?]{2,40})/i);
  if (!match?.[1]) return null;

  const value = match[1].replace(/["']/g, '').trim();
  return buildCandidate('style_observation', `nickname ${value}`, `User likes being called ${value}`, 'user', 4, 3, 0.86, 'Preferred nickname');
};

const extractRelationshipMoment = (userText: string, assistantText: string) => {
  if (!/(thank you|thanks|i appreciate you|you made my day|i needed this)/i.test(userText)) {
    return null;
  }

  const value = `Meaningful supportive exchange: user said "${userText.slice(0, 120)}" and assistant replied "${assistantText.slice(0, 120)}"`;
  return buildCandidate('relationship_moment', `moment ${userText.slice(0, 40)}`, value, 'assistant', 5, 5, 0.78, 'Positive relationship moment');
};

const dedupeCandidates = (candidates: Array<VirtualGirlfriendMemoryCandidate | null>) => {
  const unique = new Map<string, VirtualGirlfriendMemoryCandidate>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    const key = `${candidate.category}:${candidate.key}:${candidate.value.toLowerCase()}`;
    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return Array.from(unique.values());
};

export const extractVirtualGirlfriendMemoryCandidates = (input: {
  userMessage: string;
  assistantMessage: string;
}) => {
  const userText = input.userMessage.trim();
  const assistantText = input.assistantMessage.trim();

  if (!userText) {
    return [];
  }

  return dedupeCandidates([
    extractPreference(userText),
    extractFact(userText),
    extractEmotion(userText),
    extractNickname(userText),
    extractRelationshipMoment(userText, assistantText),
  ]);
};

export const persistVirtualGirlfriendMemories = async (input: {
  token: string;
  userId: string;
  companionId: string;
  conversationId: string;
  candidates: VirtualGirlfriendMemoryCandidate[];
}) => {
  const usefulCandidates = input.candidates.slice(0, 4);

  await Promise.all(
    usefulCandidates.map((candidate) =>
      upsertVirtualGirlfriendMemory(input.token, {
        userId: input.userId,
        companionId: input.companionId,
        conversationId: input.conversationId,
        candidate,
      }),
    ),
  );
};
