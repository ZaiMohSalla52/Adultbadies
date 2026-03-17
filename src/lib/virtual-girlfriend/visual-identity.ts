import crypto from 'node:crypto';
import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import {
  createVisualProfile,
  listVirtualGirlfriendCompanions,
} from '@/lib/virtual-girlfriend/data';
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
  sex?: string;
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints?: string;
  selectedPortraitPrompt?: string;
  selectedPortraitImage?: string;
  companionName: string;
  persona: PersonaProfile;
  existingCompanionSignatures?: string[];
};

const hasSemanticValue = (value: string | null | undefined) => Boolean(value && value.trim());

const resolveVisualIdentitySemanticInput = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  fallback: {
    sex?: string;
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    preferenceHints?: string;
    selectedPortraitPrompt?: string;
    selectedPortraitImage?: string;
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
      sex: structuredProfile.sex?.trim() || undefined,
      archetype: structuredProfile.archetype.trim(),
      tone: structuredProfile.tone.trim(),
      affectionStyle: structuredProfile.affectionStyle.trim(),
      visualAesthetic: structuredProfile.visualAesthetic.trim(),
      preferenceHints: structuredProfile.preferenceHints?.trim() || undefined,
      selectedPortraitPrompt: structuredProfile.selectedPortraitPrompt?.trim() || undefined,
      selectedPortraitImage: structuredProfile.selectedPortraitImage?.trim() || undefined,
    };
  }

  return {
    name: input.companion.name,
    sex: input.fallback.sex?.trim() || undefined,
    archetype: input.fallback.archetype.trim(),
    tone: input.fallback.tone.trim(),
    affectionStyle: input.fallback.affectionStyle.trim(),
    visualAesthetic: input.fallback.visualAesthetic.trim(),
    preferenceHints: input.fallback.preferenceHints?.trim() || undefined,
    selectedPortraitPrompt: input.fallback.selectedPortraitPrompt?.trim() || undefined,
    selectedPortraitImage: input.fallback.selectedPortraitImage?.trim() || undefined,
  };
};

const fallbackIdentityPack = (input: BuildIdentityInput): VirtualGirlfriendVisualIdentityPack => ({
  coreLookDescriptors: [input.visualAesthetic, input.archetype, input.tone, 'premium dating photography', 'real phone-camera portrait'],
  portraitFramingStyle: 'mix of close-up portrait, mirror selfie, and medium lifestyle framing; natural eye-level camera',
  wardrobeDirection: 'wardrobe changes by scene: one polished look, one casual look, one lifestyle look',
  lightingMoodDirection: 'mostly natural light with scene-true practical lighting; avoid studio flash look',
  realismPolishLevel: 'high realism with natural skin texture, candid imperfections, and believable phone-camera detail',
  identityInvariants: {
    ageBand: 'mid-20s to early-30s adult',
    faceShape: 'defined oval face with soft jawline',
    eyeShapeColor: 'almond eyes, warm brown tone',
    browCharacter: 'naturally full brows with gentle arch',
    noseProfile: 'straight refined bridge with soft tip',
    lipShape: 'balanced full lips with clear cupid bow',
    skinToneBand: 'medium warm skin tone range',
    hairSignature: 'deep brunette, softly wavy, chest-length',
    bodyPresentation: 'fit feminine silhouette with natural proportions',
    signatureAccessoryOrMotif: 'minimal gold jewelry accent',
  },
  cameraCompositionPreferences: [
    'eye-level focal priority on face with natural perspective',
    'mixed composition plan: close portrait, waist-up candid, half-body environmental',
    'avoid repeated angle or repeated room layout across variants',
  ],
  continuityAnchors: [...input.persona.visualPromptDNA.styleAnchors, input.companionName],
  negativeConstraints: [
    'avoid multiple people',
    'avoid distorted anatomy',
    'avoid low-resolution',
    'avoid plastic skin smoothing',
    'avoid repetitive same room composition',
    'avoid explicit nudity',
  ],
  negativeOverlapCues: [
    'avoid default bombshell clone look with heavy glam makeup every scene',
    'avoid long black straight hair + same pout + same bodycon outfit defaults',
    'avoid repeating polished nightlife-only environments',
    'avoid same-face-template outputs with only outfit swaps',
  ],
});

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
- Archetype: ${input.archetype}
- Tone: ${input.tone}
- Affection style: ${input.affectionStyle}
- Visual aesthetic: ${input.visualAesthetic}
- Preference hints: ${input.preferenceHints || 'none'}
- User-selected portrait seed prompt: ${input.selectedPortraitPrompt || 'none'}
- User-selected portrait seed image URL/data: ${input.selectedPortraitImage || 'none'}
- Persona visual DNA coreLook: ${input.persona.visualPromptDNA.coreLook}
- Persona style anchors: ${input.persona.visualPromptDNA.styleAnchors.join(', ')}
- Existing sibling signatures to avoid overlap: ${(input.existingCompanionSignatures ?? []).join(' || ') || 'none'}

Rules:
- Preserve one stable identity across all generated outputs.
- Enforce high distinctness from sibling companion signatures.
- Keep descriptors practical and image-model useful.
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
    sex?: string;
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    preferenceHints?: string;
    selectedPortraitPrompt?: string;
    selectedPortraitImage?: string;
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
    sex: semanticSetup.sex,
    archetype: semanticSetup.archetype,
    tone: semanticSetup.tone,
    affectionStyle: semanticSetup.affectionStyle,
    visualAesthetic: semanticSetup.visualAesthetic,
    preferenceHints: semanticSetup.preferenceHints,
    selectedPortraitPrompt: semanticSetup.selectedPortraitPrompt,
    selectedPortraitImage: semanticSetup.selectedPortraitImage,
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

  return { visualProfile, images: [generated.canonicalImage, ...generated.galleryImages], canonicalImage: generated.canonicalImage };
};
