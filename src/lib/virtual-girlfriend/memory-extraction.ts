import { VG_FAST_MODEL } from '@/lib/virtual-girlfriend/llm-models';
import { callTogetherChat, extractResponsesText } from '@/lib/virtual-girlfriend/llm-provider';
import type { VirtualGirlfriendMemoryCandidate, VirtualGirlfriendMemoryCategory } from '@/lib/virtual-girlfriend/types';

const MEMORY_CATEGORIES: VirtualGirlfriendMemoryCategory[] = [
  'user_fact',
  'user_preference',
  'emotional_signal',
  'relationship_moment',
  'style_observation',
];

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 10)
    .join('_');

const toCandidate = (raw: {
  category?: string;
  key?: string;
  value?: string;
  summary?: string;
  importance?: number;
  salience?: number;
  confidence?: number;
}): VirtualGirlfriendMemoryCandidate | null => {
  const category = MEMORY_CATEGORIES.find((entry) => entry === raw.category) ?? null;
  const value = typeof raw.value === 'string' ? raw.value.trim() : '';
  if (!category || value.length < 5) return null;

  const keySeed = typeof raw.key === 'string' && raw.key.trim() ? raw.key.trim() : value;
  const key = `${category}_${normalizeKey(keySeed)}`;

  return {
    key,
    category,
    value: value.slice(0, 280),
    summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 160) : undefined,
    sourceRole: 'user',
    importance: Math.min(5, Math.max(1, Number(raw.importance) || 3)),
    salience: Math.min(5, Math.max(1, Number(raw.salience) || 3)),
    confidence: Math.min(1, Math.max(0.4, Number(raw.confidence) || 0.75)),
  };
};

export const extractLlmVirtualGirlfriendMemoryCandidates = async (input: {
  userMessage: string;
  assistantMessage: string;
}): Promise<VirtualGirlfriendMemoryCandidate[]> => {
  const userText = input.userMessage.trim();
  if (!userText || userText.length < 8) return [];

  const prompt = `Extract durable memory candidates from this chat turn.
Return strict JSON only:
{
  "memories": [
    {
      "category": "user_fact|user_preference|emotional_signal|relationship_moment|style_observation",
      "key": "short stable key",
      "value": "memory sentence",
      "summary": "short label",
      "importance": 1-5,
      "salience": 1-5,
      "confidence": 0.4-1
    }
  ]
}

Rules:
- Only extract facts/preferences/emotions the USER stated or clearly implied.
- Skip greetings, flirting with no durable fact, and photo requests.
- Prefer specific details: name, job, location, likes, dislikes, boundaries, relationship cues.
- Max 3 memories.
- Do not duplicate obvious restatements.

User: ${userText}
Assistant: ${input.assistantMessage.trim().slice(0, 400)}`;

  try {
    const response = await callTogetherChat({
      model: VG_FAST_MODEL,
      input: [{ role: 'user', content: prompt }],
    });
    const parsed = JSON.parse(extractResponsesText(response)) as {
      memories?: Array<Record<string, unknown>>;
    };
    return (parsed.memories ?? [])
      .map((entry) => toCandidate(entry as Parameters<typeof toCandidate>[0]))
      .filter((candidate): candidate is VirtualGirlfriendMemoryCandidate => candidate !== null);
  } catch {
    return [];
  }
};