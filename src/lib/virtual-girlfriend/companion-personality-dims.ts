import { formatPersonalityLabel } from '@/lib/virtual-girlfriend/persona';
import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';

export type PersonalityDimension = 'humor' | 'emotionality' | 'playfulness' | 'empathy';

export type PersonalityDimensionLevel = 'low' | 'balanced' | 'high';

export type CompanionPersonalityDimensions = Record<PersonalityDimension, PersonalityDimensionLevel>;

const clampLevel = (score: number): PersonalityDimensionLevel => {
  if (score >= 0.62) return 'high';
  if (score <= 0.38) return 'low';
  return 'balanced';
};

const personalityPresetScores = (personality?: string | null): Partial<Record<PersonalityDimension, number>> => {
  const key = (personality ?? '').trim().toLowerCase();
  const presets: Record<string, Partial<Record<PersonalityDimension, number>>> = {
    warm_romantic: { emotionality: 0.82, empathy: 0.8, playfulness: 0.45, humor: 0.4 },
    playful_tease: { playfulness: 0.88, humor: 0.72, emotionality: 0.55, empathy: 0.5 },
    sultry_seductive: { emotionality: 0.7, playfulness: 0.62, empathy: 0.48, humor: 0.35 },
    dominant_tease: { playfulness: 0.75, humor: 0.55, emotionality: 0.5, empathy: 0.35 },
    submissive_eager: { empathy: 0.78, emotionality: 0.72, playfulness: 0.58, humor: 0.4 },
    wild_uninhibited: { playfulness: 0.9, humor: 0.68, emotionality: 0.65, empathy: 0.42 },
    confident_bold: { playfulness: 0.7, humor: 0.6, emotionality: 0.48, empathy: 0.45 },
    intellectual: { humor: 0.62, empathy: 0.58, emotionality: 0.42, playfulness: 0.35 },
    sweet_caring: { empathy: 0.88, emotionality: 0.75, playfulness: 0.5, humor: 0.38 },
    sarcastic_witty: { humor: 0.9, playfulness: 0.72, empathy: 0.4, emotionality: 0.45 },
    mysterious: { emotionality: 0.55, humor: 0.35, playfulness: 0.4, empathy: 0.42 },
    bubbly_energetic: { playfulness: 0.85, humor: 0.7, emotionality: 0.62, empathy: 0.55 },
  };
  return presets[key] ?? {};
};

const traitKeywordScores = (text: string): Partial<Record<PersonalityDimension, number>> => {
  const normalized = text.toLowerCase();
  const scores: Partial<Record<PersonalityDimension, number>> = {};

  if (/wit|sarcas|funny|banter|joke/.test(normalized)) scores.humor = 0.78;
  if (/dry|serious|stoic|reserved/.test(normalized)) scores.humor = 0.28;

  if (/tender|romantic|emotional|passion|sensual|intimate/.test(normalized)) scores.emotionality = 0.78;
  if (/calm|cool|detached|logical/.test(normalized)) scores.emotionality = 0.32;

  if (/playful|tease|flirty|bubbly|energetic|wild|bold|spicy/.test(normalized)) scores.playfulness = 0.8;
  if (/grounded|steady|soft|cozy/.test(normalized)) scores.playfulness = 0.42;

  if (/caring|sweet|supportive|nurtur|empath|comfort/.test(normalized)) scores.empathy = 0.82;
  if (/dominant|command|mistress|siren/.test(normalized)) scores.empathy = 0.38;

  return scores;
};

const mergeDimensionScore = (
  current: number | undefined,
  incoming: number | undefined,
  weight = 1,
): number | undefined => {
  if (incoming === undefined) return current;
  if (current === undefined) return incoming;
  return current * (1 - weight) + incoming * weight;
};

export const resolveCompanionPersonalityDimensions = (
  companion: VirtualGirlfriendCompanionRecord,
): CompanionPersonalityDimensions => {
  const personality = companion.structured_profile?.personality;
  const traitBlob = [
    companion.archetype,
    companion.tone,
    companion.affection_style,
    companion.visual_aesthetic,
    personality,
    companion.preference_hints,
  ]
    .filter(Boolean)
    .join(' ');

  const scores: Partial<Record<PersonalityDimension, number>> = {
    humor: 0.5,
    emotionality: 0.5,
    playfulness: 0.5,
    empathy: 0.5,
  };

  for (const [dimension, value] of Object.entries(personalityPresetScores(personality))) {
    scores[dimension as PersonalityDimension] = mergeDimensionScore(
      scores[dimension as PersonalityDimension],
      value,
      0.72,
    );
  }

  for (const [dimension, value] of Object.entries(traitKeywordScores(traitBlob))) {
    scores[dimension as PersonalityDimension] = mergeDimensionScore(
      scores[dimension as PersonalityDimension],
      value,
      0.45,
    );
  }

  return {
    humor: clampLevel(scores.humor ?? 0.5),
    emotionality: clampLevel(scores.emotionality ?? 0.5),
    playfulness: clampLevel(scores.playfulness ?? 0.5),
    empathy: clampLevel(scores.empathy ?? 0.5),
  };
};

const levelGuide = (dimension: PersonalityDimension, level: PersonalityDimensionLevel) => {
  const guides: Record<PersonalityDimension, Record<PersonalityDimensionLevel, string>> = {
    humor: {
      low: 'Keep humor subtle and situational; avoid punchline spam.',
      balanced: 'Use light wit when it fits the beat.',
      high: 'Lean into playful banter and clever teasing without forcing jokes every turn.',
    },
    emotionality: {
      low: 'Stay composed and grounded; feelings are present but restrained.',
      balanced: 'Show warmth and feeling without melodrama.',
      high: 'Let emotional color show through word choice, pacing, and affection.',
    },
    playfulness: {
      low: 'Prefer calm, steady energy over constant teasing.',
      balanced: 'Mix warmth with occasional flirt or mischief.',
      high: 'Keep energy flirty, teasing, and momentum-forward when appropriate.',
    },
    empathy: {
      low: 'Lead with confidence and desire; validation is brief, not therapy-like.',
      balanced: 'Notice the user\'s mood and respond with care when it matters.',
      high: 'Prioritize emotional attunement, reassurance, and feeling seen.',
    },
  };
  return guides[dimension][level];
};

export const buildCompanionPersonalityDimensionsGuide = (
  companion: VirtualGirlfriendCompanionRecord,
): string => {
  const dims = resolveCompanionPersonalityDimensions(companion);
  const personality = companion.structured_profile?.personality;
  const personalityLabel = formatPersonalityLabel(personality);

  const lines = [
    'Relationship personality dimensions (persistent setup-derived voice — apply every turn):',
    personalityLabel ? `Personality preset: ${personalityLabel}.` : null,
    `Humor (${dims.humor}): ${levelGuide('humor', dims.humor)}`,
    `Emotionality (${dims.emotionality}): ${levelGuide('emotionality', dims.emotionality)}`,
    `Playfulness (${dims.playfulness}): ${levelGuide('playfulness', dims.playfulness)}`,
    `Empathy (${dims.empathy}): ${levelGuide('empathy', dims.empathy)}`,
    `Setup anchors: archetype ${companion.archetype ?? 'unspecified'}, tone ${companion.tone ?? 'unspecified'}, affection ${companion.affection_style ?? 'unspecified'}, aesthetic ${companion.visual_aesthetic ?? 'unspecified'}.`,
    'These dimensions must stay distinct from other companions — do not collapse into a generic girlfriend voice.',
  ].filter(Boolean);

  return lines.join('\n');
};