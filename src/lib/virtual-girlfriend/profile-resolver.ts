import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendResolvedProfile,
} from '@/lib/virtual-girlfriend/types';

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) => toNonEmptyString(item)).filter((item): item is string => Boolean(item));
  return normalized.length ? normalized : null;
};

const toNullableAge = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const normalizeStructuredProfile = (value: unknown): Omit<VirtualGirlfriendResolvedProfile, 'source'> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const normalized: Omit<VirtualGirlfriendResolvedProfile, 'source'> = {
    name: toNonEmptyString(raw.name),
    sex: toNonEmptyString(raw.sex),
    origin: toNonEmptyString(raw.origin),
    ethnicity: toNonEmptyString(raw.ethnicity),
    hairColor: toNonEmptyString(raw.hairColor),
    figure: toNonEmptyString(raw.figure),
    age: toNullableAge(raw.age),
    chestSize: toNonEmptyString(raw.chestSize),
    occupation: toNonEmptyString(raw.occupation),
    personality: toNonEmptyString(raw.personality),
    sexuality: toNonEmptyString(raw.sexuality),
    freeformDetails: toNonEmptyString(raw.freeformDetails),
    likes: toStringArray(raw.likes),
    habits: toStringArray(raw.habits),
  };

  const hasAnyData = Object.values(normalized).some((field) => {
    if (Array.isArray(field)) return field.length > 0;
    return field !== null && field !== undefined;
  });

  return hasAnyData ? normalized : null;
};

const deriveLegacyProfile = (companion: VirtualGirlfriendCompanionRecord): Omit<VirtualGirlfriendResolvedProfile, 'source'> => {
  const persona = companion.persona_profile;
  const tags = companion.profile_tags ?? [];

  const personality = [
    toNonEmptyString(companion.archetype),
    toNonEmptyString(companion.tone),
    toNonEmptyString(companion.affection_style),
    ...(persona.hiddenPersonalityTraits ?? []),
    ...(persona.vibeTags ?? []),
  ]
    .map((value) => toNonEmptyString(value))
    .filter((value): value is string => Boolean(value));

  const freeformDetails = [
    toNonEmptyString(companion.display_bio),
    toNonEmptyString(persona.shortBio),
    toNonEmptyString(companion.preference_hints),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  const likes = [
    ...tags,
    ...(persona.topicTendencies ?? []),
    ...(persona.nicknameTendencies ?? []),
    ...(persona.visualPromptDNA?.styleAnchors ?? []),
  ]
    .map((value) => toNonEmptyString(value))
    .filter((value): value is string => Boolean(value));

  const habits = [toNonEmptyString(persona.textingStyle), toNonEmptyString(persona.flirtStyle), toNonEmptyString(persona.comfortStyle)].filter(
    (value): value is string => Boolean(value),
  );

  return {
    name: toNonEmptyString(companion.name) ?? toNonEmptyString(persona.displayName),
    sex: null,
    origin: null,
    ethnicity: null,
    hairColor: null,
    figure: null,
    age: null,
    chestSize: null,
    occupation: null,
    personality: toNonEmptyString(personality.join(', ')),
    sexuality: null,
    freeformDetails: toNonEmptyString(freeformDetails),
    likes: likes.length ? likes : null,
    habits: habits.length ? habits : null,
  };
};

export const resolveVirtualGirlfriendProfile = (
  companion: VirtualGirlfriendCompanionRecord,
): VirtualGirlfriendResolvedProfile => {
  const structuredProfile = normalizeStructuredProfile(companion.structured_profile);
  if (structuredProfile) {
    return {
      ...structuredProfile,
      source: 'structured_profile',
    };
  }

  return {
    ...deriveLegacyProfile(companion),
    source: 'legacy_derived',
  };
};
