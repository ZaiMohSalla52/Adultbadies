import type { VirtualGirlfriendCompanionRecord, VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';

type NormalizedProfile = {
  name: string;
  nameKey: string;
  firstName: string;
  surname: string;
  sex: string;
  origin: string;
  ethnicity: string;
  hairColor: string;
  figure: string;
  chestSize: string;
  occupation: string;
  personality: string;
  sexuality: string;
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints: string;
  freeformDetails: string;
  selectedPortraitPrompt: string;
  selectedPortraitImageKey: string;
  ageBand: string;
  likes: string[];
  habits: string[];
};

export type DistinctnessConflict = {
  companionId: string;
  companionName: string;
  nameSimilarity: number;
  profileSimilarity: number;
  reasons: string[];
  topFields: Array<{ field: string; score: number; category: 'name' | 'appearance' | 'vibe' | 'profile' }>;
  guidance: string[];
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalizeText(value).split(' ').filter(Boolean);

const tokenJaccard = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
};

const stringSimilarity = (left: string, right: string) => {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return tokenJaccard(tokenize(a), tokenize(b));
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
};

const LOW_SIGNAL_VALUES = new Set([
  'random',
  'any',
  'none',
  'n a',
  'na',
  'unknown',
  'unspecified',
  'default',
  'medium',
]);

const isInformativeValue = (value: string) => Boolean(value) && !LOW_SIGNAL_VALUES.has(value);

const normalizePortraitImageKey = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  const chunks = normalized.split('/').filter(Boolean);
  return chunks.slice(-2).join('/');
};

const parseAgeBand = (value: unknown) => {
  const text = normalizeText(value);
  if (!text) return '';

  const age = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(age)) {
    return text;
  }

  if (age <= 22) return '18-22';
  if (age <= 27) return '23-27';
  if (age <= 34) return '28-34';
  return '35+';
};

const deriveNameParts = (name: string) => {
  const tokens = tokenize(name);
  return {
    name: name.trim(),
    nameKey: tokens.join(' '),
    firstName: tokens[0] ?? '',
    surname: tokens.length > 1 ? tokens[tokens.length - 1] : '',
  };
};

const toNormalizedProfile = (profile: Record<string, unknown>): NormalizedProfile => {
  const { name, nameKey, firstName, surname } = deriveNameParts(String(profile.name ?? ''));
  return {
    name,
    nameKey,
    firstName,
    surname,
    sex: normalizeText(profile.sex),
    origin: normalizeText(profile.origin),
    ethnicity: normalizeText(profile.ethnicity),
    hairColor: normalizeText(profile.hairColor),
    figure: normalizeText(profile.figure),
    chestSize: normalizeText(profile.chestSize),
    occupation: normalizeText(profile.occupation),
    personality: normalizeText(profile.personality),
    sexuality: normalizeText(profile.sexuality),
    archetype: normalizeText(profile.archetype),
    tone: normalizeText(profile.tone),
    affectionStyle: normalizeText(profile.affectionStyle),
    visualAesthetic: normalizeText(profile.visualAesthetic),
    preferenceHints: normalizeText(profile.preferenceHints),
    freeformDetails: normalizeText(profile.freeformDetails),
    selectedPortraitPrompt: normalizeText(profile.selectedPortraitPrompt),
    selectedPortraitImageKey: normalizePortraitImageKey(profile.selectedPortraitImage),
    ageBand: parseAgeBand(profile.age),
    likes: toStringArray(profile.likes),
    habits: toStringArray(profile.habits),
  };
};

const fromCompanion = (companion: VirtualGirlfriendCompanionRecord): NormalizedProfile => {
  const structured = (companion.structured_profile ?? {}) as Record<string, unknown>;

  return toNormalizedProfile({
    ...structured,
    name: structured.name ?? companion.name,
    archetype: structured.archetype ?? companion.archetype,
    tone: structured.tone ?? companion.tone,
    affectionStyle: structured.affectionStyle ?? companion.affection_style,
    visualAesthetic: structured.visualAesthetic ?? companion.visual_aesthetic,
    preferenceHints: structured.preferenceHints ?? companion.preference_hints,
    freeformDetails: structured.freeformDetails ?? companion.display_bio,
    personality: structured.personality,
    likes: structured.likes ?? companion.profile_tags,
    habits: structured.habits,
  });
};

type WeightedComparableField =
  | 'sex'
  | 'origin'
  | 'ethnicity'
  | 'ageBand'
  | 'hairColor'
  | 'figure'
  | 'chestSize'
  | 'occupation'
  | 'personality'
  | 'sexuality'
  | 'archetype'
  | 'tone'
  | 'affectionStyle'
  | 'visualAesthetic'
  | 'selectedPortraitPrompt'
  | 'selectedPortraitImageKey';

const weightedStructuredSimilarity = (candidate: NormalizedProfile, existing: NormalizedProfile) => {
  const fieldWeights: Array<{ key: WeightedComparableField; weight: number; category: 'appearance' | 'vibe' | 'profile'; highSignal?: boolean }> = [
    { key: 'sex', weight: 0.35, category: 'appearance' },
    { key: 'origin', weight: 0.5, category: 'appearance' },
    { key: 'ethnicity', weight: 0.35, category: 'appearance' },
    { key: 'ageBand', weight: 0.45, category: 'appearance' },
    { key: 'hairColor', weight: 0.7, category: 'appearance' },
    { key: 'figure', weight: 0.7, category: 'appearance' },
    { key: 'chestSize', weight: 0.25, category: 'appearance' },
    { key: 'selectedPortraitPrompt', weight: 1.25, category: 'appearance', highSignal: true },
    { key: 'selectedPortraitImageKey', weight: 1.1, category: 'appearance', highSignal: true },
    { key: 'occupation', weight: 1.2, category: 'profile', highSignal: true },
    { key: 'personality', weight: 1.25, category: 'profile', highSignal: true },
    { key: 'sexuality', weight: 0.95, category: 'profile', highSignal: true },
    { key: 'archetype', weight: 1.1, category: 'vibe', highSignal: true },
    { key: 'tone', weight: 0.9, category: 'vibe', highSignal: true },
    { key: 'affectionStyle', weight: 0.9, category: 'vibe', highSignal: true },
    { key: 'visualAesthetic', weight: 0.95, category: 'vibe', highSignal: true },
  ];

  let totalWeight = 0;
  let overlapWeight = 0;
  let highSignalMatchWeight = 0;
  const contributors: Array<{ field: string; score: number; category: 'appearance' | 'vibe' | 'profile' }> = [];

  for (const entry of fieldWeights) {
    const left = candidate[entry.key];
    const right = existing[entry.key];
    if (!isInformativeValue(left) || !isInformativeValue(right)) continue;
    totalWeight += entry.weight;

    const fieldSimilarity = left === right ? 1 : stringSimilarity(left, right);
    const contribution = fieldSimilarity * entry.weight;
    overlapWeight += contribution;
    if (entry.highSignal && fieldSimilarity >= 0.86) {
      highSignalMatchWeight += entry.weight;
    }
    if (contribution > 0) {
      contributors.push({ field: entry.key, score: fieldSimilarity, category: entry.category });
    }
  }

  if (isInformativeValue(candidate.preferenceHints) && isInformativeValue(existing.preferenceHints)) {
    const score = stringSimilarity(candidate.preferenceHints, existing.preferenceHints);
    totalWeight += 0.85;
    overlapWeight += Math.min(0.85, score * 0.85);
    if (score > 0) contributors.push({ field: 'preferenceHints', score, category: 'vibe' });
  }

  if (isInformativeValue(candidate.freeformDetails) && isInformativeValue(existing.freeformDetails)) {
    const score = tokenJaccard(tokenize(candidate.freeformDetails), tokenize(existing.freeformDetails));
    totalWeight += 1.1;
    overlapWeight += Math.min(1.1, score * 1.1);
    if (score > 0) contributors.push({ field: 'freeformDetails', score, category: 'profile' });
  }

  const likesScore = tokenJaccard(candidate.likes, existing.likes);
  const habitsScore = tokenJaccard(candidate.habits, existing.habits);
  if (candidate.likes.length && existing.likes.length) {
    totalWeight += 0.6;
    overlapWeight += likesScore * 0.6;
    if (likesScore > 0) contributors.push({ field: 'likes', score: likesScore, category: 'profile' });
  }

  if (candidate.habits.length && existing.habits.length) {
    totalWeight += 0.6;
    overlapWeight += habitsScore * 0.6;
    if (habitsScore > 0) contributors.push({ field: 'habits', score: habitsScore, category: 'profile' });
  }

  const score = totalWeight > 0 ? overlapWeight / totalWeight : 0;
  return {
    score,
    highSignalMatchWeight,
    topFields: contributors
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  };
};

const nameSimilarityScore = (candidate: NormalizedProfile, existing: NormalizedProfile) => {
  if (!candidate.nameKey || !existing.nameKey) return 0;
  if (candidate.nameKey === existing.nameKey) return 1;

  const full = stringSimilarity(candidate.nameKey, existing.nameKey);
  const first = stringSimilarity(candidate.firstName, existing.firstName);
  const sameSurname = Boolean(candidate.surname && existing.surname && candidate.surname === existing.surname);

  if (sameSurname && first >= 0.72) return Math.max(full, 0.9);
  return full;
};

const toConflictGuidance = (reasons: string[], topFields: DistinctnessConflict['topFields']) => {
  const guidance = new Set<string>();
  if (reasons.includes('exact_name_match') || reasons.includes('near_duplicate_name')) {
    guidance.add('Try a more distinct name.');
  }
  if (topFields.some((field) => field.category === 'appearance')) {
    guidance.add('Try changing appearance choices or pick a different portrait.');
  }
  if (topFields.some((field) => field.category === 'vibe')) {
    guidance.add('Try changing relationship vibe, tone, or aesthetic.');
  }
  if (topFields.some((field) => field.category === 'profile')) {
    guidance.add('Try changing personality, occupation, or profile details.');
  }
  return [...guidance];
};

export const findDistinctnessConflict = (input: {
  candidateProfile: VirtualGirlfriendStructuredProfile;
  existingCompanions: VirtualGirlfriendCompanionRecord[];
  excludeCompanionId?: string;
}): DistinctnessConflict | null => {
  const candidate = toNormalizedProfile(input.candidateProfile as unknown as Record<string, unknown>);

  let topConflict: DistinctnessConflict | null = null;

  for (const companion of input.existingCompanions) {
    if (input.excludeCompanionId && companion.id === input.excludeCompanionId) continue;

    const existing = fromCompanion(companion);
    const nameSimilarity = nameSimilarityScore(candidate, existing);
    const structured = weightedStructuredSimilarity(candidate, existing);

    const reasons: string[] = [];
    if (nameSimilarity === 1) {
      reasons.push('exact_name_match');
    } else if (nameSimilarity >= 0.84) {
      reasons.push('near_duplicate_name');
    }

    if (candidate.surname && existing.surname && candidate.surname === existing.surname && stringSimilarity(candidate.firstName, existing.firstName) >= 0.65) {
      reasons.push('surname_family_pattern_risk');
    }

    if (
      structured.score >= 0.9 ||
      (structured.score >= 0.84 && structured.highSignalMatchWeight >= 4.1) ||
      (nameSimilarity >= 0.92 && structured.score >= 0.72)
    ) {
      reasons.push('structured_profile_overlap');
    }

    const blocked = reasons.length > 0;
    if (!blocked) continue;

    const conflict: DistinctnessConflict = {
      companionId: companion.id,
      companionName: companion.name,
      nameSimilarity,
      profileSimilarity: structured.score,
      reasons,
      topFields: structured.topFields.map((field) => ({
        field: field.field,
        score: Number(field.score.toFixed(3)),
        category: field.category,
      })),
      guidance: toConflictGuidance(reasons, structured.topFields.map((field) => ({
        field: field.field,
        score: Number(field.score.toFixed(3)),
        category: field.category,
      }))),
    };

    if (!topConflict || conflict.profileSimilarity + conflict.nameSimilarity > topConflict.profileSimilarity + topConflict.nameSimilarity) {
      topConflict = conflict;
    }
  }

  return topConflict;
};
