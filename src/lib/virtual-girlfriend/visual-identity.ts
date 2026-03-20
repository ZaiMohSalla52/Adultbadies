import crypto from 'node:crypto';
import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import {
  createVisualProfile,
  listVirtualGirlfriendCompanions,
  setCanonicalReferenceImageForVisualProfile,
} from '@/lib/virtual-girlfriend/data';
import { PROMPT_VERSION } from '@/lib/virtual-girlfriend/prompt-builder/versions';
import {
  runRegenerateCanonicalOnlyImageMachine,
  runRegenerateCanonicalWithGalleryImageMachine,
  runSetupImageMachine,
} from '@/lib/virtual-girlfriend/image-machine';
import type {
  PersonaProfile,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendSetupPayload,
  VirtualGirlfriendVisualIdentityPack,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const STYLE_VERSION = 'vg-image-v3';
const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

type BuildIdentityInput = {
  origin?: string;
  sex?: string;
  age?: number;
  hairColor?: string;
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  occupation?: string;
  personality?: string;
  preferenceHints?: string;
  selectedPortraitPrompt?: string;
  selectedPortraitImage?: string;
  hairLength?: string;
  eyeColor?: string;
  skinTone?: string;
  styleVibe?: string;
  bodyType?: string;
  figure?: string;
  companionName: string;
  persona: PersonaProfile;
  existingCompanionSignatures?: string[];
};

const hasSemanticValue = (value: string | null | undefined) => Boolean(value && value.trim());

const resolveVisualIdentitySemanticInput = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  fallback: {
    origin?: string;
    sex?: string;
    age?: string | number;
    hairColor?: string;
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    occupation?: string;
    personality?: string;
    preferenceHints?: string;
    selectedPortraitPrompt?: string;
    selectedPortraitImage?: string;
    hairLength?: string;
    eyeColor?: string;
    skinTone?: string;
    styleVibe?: string;
    bodyType?: string;
    figure?: string;
  };
}): VirtualGirlfriendSetupPayload => {
  const structuredProfile = input.companion.structured_profile;

  if (
    structuredProfile
    && hasSemanticValue(structuredProfile.name)
    && hasSemanticValue(structuredProfile.archetype)
    && hasSemanticValue(structuredProfile.tone)
    && hasSemanticValue(structuredProfile.affectionStyle)
    && hasSemanticValue(structuredProfile.visualAesthetic)
  ) {
    return {
      name: structuredProfile.name.trim(),
      origin: structuredProfile.origin?.trim() || undefined,
      sex: structuredProfile.sex?.trim() || undefined,
      age: structuredProfile.age ? Number(structuredProfile.age) : undefined,
      hairColor: structuredProfile.hairColor?.trim() || undefined,
      archetype: structuredProfile.archetype.trim(),
      tone: structuredProfile.tone.trim(),
      affectionStyle: structuredProfile.affectionStyle.trim(),
      visualAesthetic: structuredProfile.visualAesthetic.trim(),
      occupation: structuredProfile.occupation?.trim() || undefined,
      personality: structuredProfile.personality?.trim() || undefined,
      preferenceHints: structuredProfile.preferenceHints?.trim() || undefined,
      selectedPortraitPrompt: structuredProfile.selectedPortraitPrompt?.trim() || undefined,
      selectedPortraitImage: structuredProfile.selectedPortraitImage?.trim() || undefined,
      hairLength: structuredProfile.hairLength?.trim() || undefined,
      eyeColor: structuredProfile.eyeColor?.trim() || undefined,
      skinTone: structuredProfile.skinTone?.trim() || undefined,
      styleVibe: structuredProfile.styleVibe?.trim() || undefined,
      bodyType: structuredProfile.bodyType?.trim() || undefined,
      figure: structuredProfile.figure?.trim() || undefined,
    };
  }

  return {
    name: input.companion.name,
    origin: input.fallback.origin?.trim() || undefined,
    sex: input.fallback.sex?.trim() || undefined,
    age: input.fallback.age !== undefined ? Number(input.fallback.age) : undefined,
    hairColor: input.fallback.hairColor?.trim() || undefined,
    archetype: input.fallback.archetype.trim(),
    tone: input.fallback.tone.trim(),
    affectionStyle: input.fallback.affectionStyle.trim(),
    visualAesthetic: input.fallback.visualAesthetic.trim(),
    occupation: input.fallback.occupation?.trim() || undefined,
    personality: input.fallback.personality?.trim() || undefined,
    preferenceHints: input.fallback.preferenceHints?.trim() || undefined,
    selectedPortraitPrompt: input.fallback.selectedPortraitPrompt?.trim() || undefined,
    selectedPortraitImage: input.fallback.selectedPortraitImage?.trim() || undefined,
    hairLength: input.fallback.hairLength?.trim() || undefined,
    eyeColor: input.fallback.eyeColor?.trim() || undefined,
    skinTone: input.fallback.skinTone?.trim() || undefined,
    styleVibe: input.fallback.styleVibe?.trim() || undefined,
    bodyType: input.fallback.bodyType?.trim() || input.fallback.figure?.trim() || undefined,
    figure: input.fallback.figure?.trim() || undefined,
  };
};

const fallbackIdentityPack = (input: BuildIdentityInput): VirtualGirlfriendVisualIdentityPack => {
  const ageRange = input.age && Number.isFinite(input.age)
    ? `${Math.max(18, Math.floor(input.age - 2))}-${Math.max(19, Math.floor(input.age + 2))}`
    : '22-28';
  const resolvedStyle = input.styleVibe?.trim() || 'casual';
  const resolvedHairColor = input.hairColor?.trim() || 'dark';
  const resolvedHairLength = input.hairLength?.trim() || 'medium';
  const resolvedEyeColor = input.eyeColor?.trim() || 'brown';
  const resolvedOrigin = input.origin?.trim() || 'mixed';
  const resolvedSkinTone = input.skinTone?.trim() || 'medium';
  const resolvedBody = input.bodyType?.trim() || input.figure?.trim() || 'balanced';

  return {
    continuityAnchors: [
      `${resolvedOrigin} person`,
      `${resolvedHairColor} ${resolvedHairLength} hair`,
      `${resolvedEyeColor} eyes`,
      ...input.persona.visualPromptDNA.styleAnchors,
      input.companionName,
    ],
    coreLookDescriptors: [
      `${resolvedOrigin} appearance`,
      'natural look',
      `${resolvedStyle} style`,
      `${resolvedBody} build`,
      input.visualAesthetic,
      input.archetype,
      input.tone,
    ],
    portraitFramingStyle: 'mix of close-up portrait, mirror selfie, and medium lifestyle framing; natural eye-level camera',
    wardrobeDirection: resolvedStyle === 'glamorous' ? 'elegant evening wear' : 'casual everyday clothing',
    lightingMoodDirection: 'warm natural lighting',
    cameraCompositionPreferences: ['medium close-up', 'shallow depth of field'],
    realismPolishLevel: 'photorealistic editorial',
    negativeConstraints: ['harsh flash', 'overexposed'],
    negativeOverlapCues: [],
    identityInvariants: {
      ageBand: ageRange,
      faceShape: 'natural',
      eyeShapeColor: `${resolvedEyeColor} eyes`,
      browCharacter: 'natural brows',
      noseProfile: 'natural profile',
      lipShape: 'natural lip shape',
      skinToneBand: resolvedSkinTone,
      hairSignature: `${resolvedHairColor} ${resolvedHairLength}`,
      bodyPresentation: `${resolvedBody} build`,
      signatureAccessoryOrMotif: 'minimal accessory',
    },
  };
};

const sanitizePack = (raw: VirtualGirlfriendVisualIdentityPack, fallback: VirtualGirlfriendVisualIdentityPack) => ({
  ...fallback,
  ...raw,
  coreLookDescriptors: raw.coreLookDescriptors?.filter(Boolean)?.slice(0, 14) ?? fallback.coreLookDescriptors,
  cameraCompositionPreferences: raw.cameraCompositionPreferences?.filter(Boolean)?.slice(0, 12) ?? fallback.cameraCompositionPreferences,
  continuityAnchors: raw.continuityAnchors?.filter(Boolean)?.slice(0, 14) ?? fallback.continuityAnchors,
  negativeConstraints: raw.negativeConstraints?.filter(Boolean)?.slice(0, 16) ?? fallback.negativeConstraints,
  negativeOverlapCues: raw.negativeOverlapCues?.filter(Boolean)?.slice(0, 12) ?? fallback.negativeOverlapCues,
  identityInvariants: {
    ...fallback.identityInvariants,
    ...(raw.identityInvariants ?? {}),
  },
});

const buildVisualIdentityPack = async (input: BuildIdentityInput): Promise<VirtualGirlfriendVisualIdentityPack> => {
  const fallback = fallbackIdentityPack(input);
  const appearanceLines = [
    input.origin?.trim() ? `- Origin / ethnicity: ${input.origin.trim()}` : null,
    Number.isFinite(input.age) ? `- Age: ${input.age}` : null,
    input.hairColor?.trim() ? `- Hair color: ${input.hairColor.trim()}` : null,
    input.hairLength?.trim() ? `- Hair length: ${input.hairLength.trim()}` : null,
    input.eyeColor?.trim() ? `- Eye color: ${input.eyeColor.trim()}` : null,
    input.skinTone?.trim() ? `- Skin tone: ${input.skinTone.trim()}` : null,
    input.styleVibe?.trim() ? `- Style vibe: ${input.styleVibe.trim()}` : null,
    input.occupation?.trim() ? `- Occupation: ${input.occupation.trim()}` : null,
    input.personality?.trim() ? `- Personality: ${input.personality.trim()}` : null,
    (input.bodyType?.trim() || input.figure?.trim())
      ? `- Body silhouette: ${input.bodyType?.trim() || input.figure?.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Return strict JSON with this schema only:
{
  "coreLookDescriptors": string[],
  "portraitFramingStyle": string,
  "wardrobeDirection": string,
  "lightingMoodDirection": string,
  "realismPolishLevel": string,
  "identityInvariants": {
    "ageBand": string,
    "faceShape": string,
    "eyeShapeColor": string,
    "browCharacter": string,
    "noseProfile": string,
    "lipShape": string,
    "skinToneBand": string,
    "hairSignature": string,
    "bodyPresentation": string,
    "signatureAccessoryOrMotif": string
  },
  "cameraCompositionPreferences": string[],
  "continuityAnchors": string[],
  "negativeConstraints": string[],
  "negativeOverlapCues": string[]
}

Input profile:
- Companion name: ${input.companionName}
- Sex: ${input.sex || 'female'}
- Ethnicity/origin: ${input.origin || 'mixed'}
- Age: ${Number.isFinite(input.age) ? input.age : 'mid-20s'}
- Hair color: ${input.hairColor || 'dark brown'}
- Archetype: ${input.archetype}
- Tone: ${input.tone}
- Affection style: ${input.affectionStyle}
- Visual aesthetic: ${input.visualAesthetic}
- Occupation: ${input.occupation || 'not specified'}
- Personality: ${input.personality || 'not specified'}
- Preference hints: ${input.preferenceHints || 'none'}
- User-selected portrait seed prompt: ${input.selectedPortraitPrompt || 'none'}
- User-selected portrait seed image URL/data: ${input.selectedPortraitImage || 'none'}
${appearanceLines ? `${appearanceLines}
` : ''}- Persona visual DNA coreLook: ${input.persona.visualPromptDNA.coreLook}
- Persona style anchors: ${input.persona.visualPromptDNA.styleAnchors.join(', ')}
- Existing sibling signatures to avoid overlap: ${(input.existingCompanionSignatures ?? []).join(' || ') || 'none'}

Rules:
- Preserve one stable identity across all generated outputs.
- Enforce high distinctness from sibling companion signatures.
- Keep descriptors practical and image-model useful.
- Encode ethnicity and explicit skin color as top-priority identity anchors.
- Keep negative constraints explicit for anatomy quality, identity drift, and duplicate-scene drift.
- Prevent all outputs from collapsing into cozy indoor portraits.
- Prioritize realistic natural-lighting and believable phone-camera photography.
- If portrait seed prompt/image are provided, use them as direct identity anchor signals (face/hair/age continuity) while still producing original generated imagery.
- Maintain same-identity continuity across future images.
- Dating-app appropriate, premium, and believable.
- No explicit sexual content.`;

  try {
    const response = await callOpenAIResponses({
      model: 'gpt-5-mini',
      input: [{ role: 'user', content: prompt }],
      reasoning: { effort: 'medium' },
    });

    const parsed = JSON.parse(extractResponsesText(response)) as VirtualGirlfriendVisualIdentityPack;
    return sanitizePack(parsed, fallback);
  } catch {
    return fallback;
  }
};

export { VirtualGirlfriendImagePackError, VirtualGirlfriendCanonicalRegenerateError } from '@/lib/virtual-girlfriend/image-machine';

export const regenerateCanonicalForVisualProfile = async (input: {
  token: string;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
  requestedBy: string;
  regenerateGallery: boolean;
}) => {
  if (input.regenerateGallery) {
    return runRegenerateCanonicalWithGalleryImageMachine({
      token: input.token,
      visualProfile: input.visualProfile,
      requestedBy: input.requestedBy,
    });
  }

  return runRegenerateCanonicalOnlyImageMachine({
    token: input.token,
    visualProfile: input.visualProfile,
    requestedBy: input.requestedBy,
  });
};

export const generateAndPersistVirtualGirlfriendImagePack = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  setup: {
    origin?: string;
    sex?: string;
    age?: number | string;
    hairColor?: string;
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    occupation?: string;
    personality?: string;
    preferenceHints?: string;
    selectedPortraitPrompt?: string;
    selectedPortraitImage?: string;
    hairLength?: string;
    eyeColor?: string;
    skinTone?: string;
    styleVibe?: string;
    bodyType?: string;
    figure?: string;
  };
}) => {
  const semanticSetup = resolveVisualIdentitySemanticInput({ companion: input.companion, fallback: input.setup });

  const allCompanions = await listVirtualGirlfriendCompanions(input.token, input.userId);
  const siblingCompanionSignatures = allCompanions
    .filter((companion) => companion.id !== input.companion.id)
    .slice(0, 8)
    .map((companion) => {
      const tags = companion.profile_tags?.slice(0, 4).join(', ') || 'no-tags';
      return `${companion.name}|${companion.archetype ?? 'n/a'}|${companion.visual_aesthetic ?? 'n/a'}|${tags}`;
    });

  const identityPack = await buildVisualIdentityPack({
    origin: semanticSetup.origin,
    sex: semanticSetup.sex,
    age: semanticSetup.age ? Number(semanticSetup.age) : undefined,
    hairColor: semanticSetup.hairColor,
    archetype: semanticSetup.archetype,
    tone: semanticSetup.tone,
    affectionStyle: semanticSetup.affectionStyle,
    visualAesthetic: semanticSetup.visualAesthetic,
    occupation: semanticSetup.occupation,
    personality: semanticSetup.personality,
    preferenceHints: semanticSetup.preferenceHints,
    selectedPortraitPrompt: semanticSetup.selectedPortraitPrompt,
    selectedPortraitImage: semanticSetup.selectedPortraitImage,
    hairLength: semanticSetup.hairLength,
    eyeColor: semanticSetup.eyeColor,
    skinTone: semanticSetup.skinTone,
    styleVibe: semanticSetup.styleVibe,
    bodyType: semanticSetup.bodyType,
    figure: semanticSetup.figure,
    companionName: semanticSetup.name,
    persona: input.companion.persona_profile,
    existingCompanionSignatures: siblingCompanionSignatures,
  });

  const visualProfile = await createVisualProfile(input.token, {
    userId: input.userId,
    companionId: input.companion.id,
    styleVersion: STYLE_VERSION,
    promptHash: sha(JSON.stringify(identityPack)),
    sourceSetup: semanticSetup,
    identityPack,
    continuityNotes: 'Identity continuity anchored by canonical image machine.',
    moderationStatus: 'pending',
    provenance: { generatedBy: 'openai:gpt-5-mini', phase: 'image-machine-pass-c' },
  });

  const generated = await runSetupImageMachine({
    kind: 'setup_pack',
    token: input.token,
    userId: input.userId,
    companion: input.companion,
    visualProfile,
  });

  const updatedVisualProfile = await setCanonicalReferenceImageForVisualProfile(input.token, {
    userId: input.userId,
    visualProfileId: visualProfile.id,
    canonicalReferenceImageId: generated.canonicalImage.id,
    canonicalReferenceMetadata: {
      source: 'setup_generation',
      canonicalGeneratedAt: generated.canonicalImage.created_at,
    },
    canonicalReviewStatus: 'pending',
    seedPrompt: generated.canonicalImage.prompt_text?.trim() || undefined,
    promptVersion: PROMPT_VERSION.canonical,
    surfaceType: 'canonical',
  });

  return {
    visualProfile: updatedVisualProfile ?? visualProfile,
    images: [generated.canonicalImage, ...generated.galleryImages],
    canonicalImage: generated.canonicalImage,
  };
};
