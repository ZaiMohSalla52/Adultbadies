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
  freeformDetails?: string;
  selectedPortraitPrompt?: string;
  hairLength?: string;
  eyeColor?: string;
  skinTone?: string;
  breastSize?: string;
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

const WARDROBE_BY_STYLE: Record<string, string> = {
  casual: 'relaxed casual everyday clothing, jeans or simple outfit',
  elegant: 'elegant refined clothing, polished look with tasteful accessories',
  edgy: 'edgy streetwear, leather or statement pieces, bold styling',
  bohemian: 'flowy bohemian clothing, earthy tones, layered textures',
  sporty: 'athletic activewear, fitted sportswear, clean sneakers',
  professional: 'sharp professional attire, blazer or tailored clothing',
  glamorous: 'glamorous evening wear, luxurious fabrics, statement styling',
};

const LIGHTING_BY_PERSONALITY: Record<string, string> = {
  warm_romantic: 'warm golden-hour soft lighting, intimate and glowing',
  playful_tease: 'bright playful lighting with natural warmth',
  confident_bold: 'dramatic high-contrast cinematic lighting',
  intellectual: 'clean cool diffused natural lighting',
  sweet_caring: 'soft warm gentle lighting, cozy atmosphere',
  sarcastic_witty: 'sharp clean lighting with crisp contrast',
  mysterious: 'moody low-key cinematic lighting, deep shadows',
  bubbly_energetic: 'bright vibrant sunny natural lighting',
};

const FACE_SHAPE_BY_ARCHETYPE: Record<string, string> = {
  'girl next door': 'approachable oval face shape',
  'femme fatale': 'sharp defined angular face with strong cheekbones',
  'intellectual': 'refined oval face, intelligent bright eyes',
  'free spirit': 'soft rounded face with expressive eyes',
  'dominant': 'strong defined jawline, intense piercing gaze',
  'submissive': 'soft delicate features, gentle rounded face',
  'romantic': 'soft heart-shaped face, warm inviting eyes',
  'playful': 'bright round face with mischievous sparkling eyes',
};

const ACCESSORY_BY_STYLE: Record<string, string> = {
  casual: 'simple stud earrings or delicate necklace',
  elegant: 'pearl earrings or dainty gold jewelry',
  edgy: 'bold ear cuffs or layered chain necklace',
  bohemian: 'hoop earrings or beaded bracelets',
  sporty: 'minimal accessories, clean look',
  professional: 'subtle stud earrings, classic watch',
  glamorous: 'statement drop earrings or diamond jewelry',
};

const fallbackIdentityPack = (input: BuildIdentityInput): VirtualGirlfriendVisualIdentityPack => {
  const ageRange = input.age && Number.isFinite(input.age)
    ? `${Math.max(18, Math.floor(input.age - 2))}-${Math.max(19, Math.floor(input.age + 2))}`
    : '22-28';
  const resolvedStyle = input.styleVibe?.trim().toLowerCase() || 'casual';
  const resolvedHairColor = input.hairColor?.trim() || 'dark brown';
  const resolvedHairLength = input.hairLength?.trim() || 'medium';
  const resolvedEyeColor = input.eyeColor?.trim() || 'brown';
  const resolvedOrigin = input.origin?.trim() || 'mixed';
  const resolvedSkinTone = input.skinTone?.trim() || 'medium';
  const resolvedBody = input.bodyType?.trim() || input.figure?.trim() || 'slim';
  const resolvedArchetype = input.archetype?.trim().toLowerCase() || '';
  const resolvedPersonality = input.personality?.trim().toLowerCase() || '';
  const resolvedOccupation = input.occupation?.trim() || '';

  const wardrobeDirection = WARDROBE_BY_STYLE[resolvedStyle] ?? 'stylish casual clothing';
  const lightingMood = LIGHTING_BY_PERSONALITY[resolvedPersonality] ?? 'warm cinematic natural lighting with shallow depth of field';
  const faceShape = FACE_SHAPE_BY_ARCHETYPE[resolvedArchetype] ?? 'symmetrical face with expressive eyes and defined features';
  const accessory = ACCESSORY_BY_STYLE[resolvedStyle] ?? 'minimal tasteful accessories';
  const occupationCue = resolvedOccupation ? `${resolvedOccupation} lifestyle visual cues` : null;

  return {
    continuityAnchors: [
      `${resolvedOrigin} heritage`,
      `${resolvedHairColor} ${resolvedHairLength} hair`,
      `${resolvedEyeColor} eyes`,
      `${resolvedSkinTone} skin tone`,
      `${resolvedBody} build`,
      ...input.persona.visualPromptDNA.styleAnchors,
    ].filter(Boolean),
    coreLookDescriptors: [
      `${resolvedOrigin} heritage features`,
      `${resolvedHairColor} ${resolvedHairLength} hair`,
      `${resolvedEyeColor} eyes`,
      `${resolvedBody} body`,
      `${resolvedStyle} aesthetic`,
      input.visualAesthetic,
      input.archetype,
      ...(occupationCue ? [occupationCue] : []),
    ].filter(Boolean),
    portraitFramingStyle: 'cinematic portrait framing; natural eye-level; environmental context visible',
    wardrobeDirection,
    lightingMoodDirection: lightingMood,
    cameraCompositionPreferences: ['medium close-up to waist-up', 'shallow depth of field bokeh background', 'natural perspective no fisheye'],
    realismPolishLevel: 'hyper-realistic candid photography, film grain texture, natural imperfections',
    negativeConstraints: ['harsh flash photography', 'overexposed blown-out skin', 'plastic airbrushed look', 'studio white background'],
    negativeOverlapCues: [],
    identityInvariants: {
      ageBand: ageRange,
      faceShape,
      eyeShapeColor: `${resolvedEyeColor} eyes with natural lashes`,
      browCharacter: `well-defined ${resolvedHairColor.includes('blonde') || resolvedHairColor.includes('platinum') ? 'light' : 'dark'} brows`,
      noseProfile: 'defined natural nose profile consistent across angles',
      lipShape: `full natural lips, ${resolvedPersonality === 'playful_tease' || resolvedPersonality === 'confident_bold' ? 'slightly bold' : 'natural'} lip shape`,
      skinToneBand: resolvedSkinTone,
      hairSignature: `${resolvedHairColor} ${resolvedHairLength} hair, consistent style`,
      bodyPresentation: `${resolvedBody} figure`,
      signatureAccessoryOrMotif: accessory,
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
    input.breastSize?.trim() ? `- Breast size: ${input.breastSize.trim()}` : null,
    input.styleVibe?.trim() ? `- Style vibe: ${input.styleVibe.trim()}` : null,
    input.occupation?.trim() ? `- Occupation: ${input.occupation.trim()}` : null,
    input.personality?.trim() ? `- Personality: ${input.personality.trim()}` : null,
    (input.bodyType?.trim() || input.figure?.trim())
      ? `- Body silhouette: ${input.bodyType?.trim() || input.figure?.trim()}`
      : null,
    input.freeformDetails?.trim() ? `- User custom description: ${input.freeformDetails.trim()}` : null,
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
${appearanceLines ? `${appearanceLines}\n` : ''}- Persona visual DNA coreLook: ${input.persona.visualPromptDNA.coreLook}
- Persona style anchors: ${input.persona.visualPromptDNA.styleAnchors.join(', ')}
- Existing sibling signatures to avoid overlap: ${(input.existingCompanionSignatures ?? []).join(' || ') || 'none'}

Rules:
- Preserve one highly distinctive stable identity across all generated outputs.
- Enforce high distinctness from sibling companion signatures listed above.
- Keep descriptors specific, practical, and image-model useful — avoid generic placeholder words.
- Encode ethnicity and explicit skin color as top-priority identity anchors.
- Keep negative constraints explicit for anatomy quality, identity drift, and duplicate-scene drift.
- Generate variety: portraits, lifestyle, outdoor, indoor, bar/restaurant, nature, urban — not just cozy indoor.
- Prioritize cinematic natural-lighting with shallow depth of field and believable real-world environments.
- If portrait seed prompt is provided, use it as direct identity anchor for face/hair/age continuity.
- Maintain same-identity continuity across future images.
- If user custom description is provided, prioritize it as the strongest identity signal.
- Dating-app appropriate, premium, and believable — hyper-realistic photography style.
- No explicit sexual content.`;

  try {
    const response = await callOpenAIResponses({
      model: 'gpt-4o-mini',
      input: [{ role: 'user', content: prompt }],
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
    freeformDetails?: string;
    selectedPortraitPrompt?: string;
    selectedPortraitImage?: string;
    hairLength?: string;
    eyeColor?: string;
    skinTone?: string;
    breastSize?: string;
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
    freeformDetails: semanticSetup.freeformDetails ?? input.setup.freeformDetails,
    selectedPortraitPrompt: semanticSetup.selectedPortraitPrompt,
    hairLength: semanticSetup.hairLength,
    eyeColor: semanticSetup.eyeColor,
    skinTone: semanticSetup.skinTone,
    breastSize: (semanticSetup as { breastSize?: string }).breastSize ?? input.setup.breastSize,
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
    provenance: { generatedBy: 'openai:gpt-4o-mini', phase: 'image-machine-pass-c' },
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
