import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendResolvedProfile,
  VirtualGirlfriendStructuredProfile,
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

const normalizeStructuredProfile = (value: unknown): VirtualGirlfriendStructuredProfile | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const name = toNonEmptyString(raw.name);
  const archetype = toNonEmptyString(raw.archetype);
  const tone = toNonEmptyString(raw.tone);
  const affectionStyle = toNonEmptyString(raw.affectionStyle);
  const visualAesthetic = toNonEmptyString(raw.visualAesthetic);

  if (!name || !archetype || !tone || !affectionStyle || !visualAesthetic) {
    return null;
  }

  return {
    schemaVersion: 1,
    name,
    archetype,
    tone,
    affectionStyle,
    visualAesthetic,
    preferenceHints: toNonEmptyString(raw.preferenceHints),
  };
};

const deriveLegacyProfile = (companion: VirtualGirlfriendCompanionRecord): VirtualGirlfriendResolvedProfile => {
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
    source: 'legacy_derived',
    name: toNonEmptyString(companion.name) ?? toNonEmptyString(persona.displayName),
    archetype: toNonEmptyString(companion.archetype),
    tone: toNonEmptyString(companion.tone),
    affectionStyle: toNonEmptyString(companion.affection_style),
    visualAesthetic: toNonEmptyString(companion.visual_aesthetic),
    preferenceHints: toNonEmptyString(companion.preference_hints),
    personality: toNonEmptyString(personality.join(', ')),
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
      source: 'structured_profile',
      name: structuredProfile.name,
      archetype: structuredProfile.archetype,
      tone: structuredProfile.tone,
      affectionStyle: structuredProfile.affectionStyle,
      visualAesthetic: structuredProfile.visualAesthetic,
      preferenceHints: structuredProfile.preferenceHints,
      personality: null,
      freeformDetails: toNonEmptyString(companion.display_bio) ?? toNonEmptyString(companion.persona_profile.shortBio),
      likes: toStringArray(companion.profile_tags),
      habits: null,
    };
  }

  return deriveLegacyProfile(companion);
};
