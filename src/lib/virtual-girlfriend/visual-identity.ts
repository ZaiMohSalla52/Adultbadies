import crypto from 'node:crypto';
import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import {
  generateCanonicalImageWithIdeogram,
  generateGalleryImageFromReferenceWithIdeogram,
} from '@/lib/virtual-girlfriend/image-ideogram';
import { uploadToR2 } from '@/lib/storage/r2';
import { uploadToCloudinary } from '@/lib/storage/cloudinary';
import type {
  PersonaProfile,
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendSetupPayload,
  VirtualGirlfriendVisualIdentityPack,
} from '@/lib/virtual-girlfriend/types';
import {
  createVisualProfile,
  getVirtualGirlfriendCompanionById,
  insertCompanionImages,
  listVirtualGirlfriendCompanions,
  setCanonicalReferenceImageId,
  setCanonicalReferenceImageForVisualProfile,
} from '@/lib/virtual-girlfriend/data';

const STYLE_VERSION = 'vg-image-v3';
const IDEOGRAM_PROVIDER = 'ideogram';

type BuildIdentityInput = {
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
    archetype: input.fallback.archetype.trim(),
    tone: input.fallback.tone.trim(),
    affectionStyle: input.fallback.affectionStyle.trim(),
    visualAesthetic: input.fallback.visualAesthetic.trim(),
    preferenceHints: input.fallback.preferenceHints?.trim() || undefined,
    selectedPortraitPrompt: input.fallback.selectedPortraitPrompt?.trim() || undefined,
    selectedPortraitImage: input.fallback.selectedPortraitImage?.trim() || undefined,
  };
};

type CapturePlan = {
  kind: 'canonical' | 'gallery';
  variantIndex: number;
  label: string;
  framing: string;
  environment: string;
  mood: string;
  wardrobe: string;
  expression: string;
  glamourLevel: string;
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
  coreLookDescriptors: raw.coreLookDescriptors?.length ? raw.coreLookDescriptors : fallback.coreLookDescriptors,
  continuityAnchors: raw.continuityAnchors?.length ? raw.continuityAnchors : fallback.continuityAnchors,
  negativeConstraints: raw.negativeConstraints?.length ? raw.negativeConstraints : fallback.negativeConstraints,
  negativeOverlapCues: raw.negativeOverlapCues?.length ? raw.negativeOverlapCues : fallback.negativeOverlapCues,
  cameraCompositionPreferences: raw.cameraCompositionPreferences?.length
    ? raw.cameraCompositionPreferences
    : fallback.cameraCompositionPreferences,
  identityInvariants: {
    ...fallback.identityInvariants,
    ...(raw.identityInvariants ?? {}),
  },
});

export const buildVisualIdentityPack = async (input: BuildIdentityInput) => {
  const fallback = fallbackIdentityPack(input);

  const prompt = `Build a strict JSON visual identity pack for a premium virtual girlfriend image system.
Context:
- Name: ${input.companionName}
- Archetype: ${input.archetype}
- Tone: ${input.tone}
- Affection style: ${input.affectionStyle}
- Visual aesthetic: ${input.visualAesthetic}
- User hints: ${input.preferenceHints || 'none'}
- Persona core look: ${input.persona.visualPromptDNA.coreLook}
- Persona anchors: ${input.persona.visualPromptDNA.styleAnchors.join(', ')}
- Persona camera mood: ${input.persona.visualPromptDNA.cameraMood}
- User-selected portrait seed prompt: ${input.selectedPortraitPrompt || 'none'}
- User-selected portrait seed image URL/data: ${input.selectedPortraitImage || 'none'}
- Existing companion signatures to avoid similarity with: ${
    input.existingCompanionSignatures?.length ? input.existingCompanionSignatures.join(' | ') : 'none'
  }

Output JSON only with keys:
{
  "coreLookDescriptors": string[6..14],
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
  "cameraCompositionPreferences": string[3..8],
  "continuityAnchors": string[6..16],
  "negativeConstraints": string[6..16],
  "negativeOverlapCues": string[4..10]
}

Requirements:
- Strongly map archetype/tone/aesthetic to wardrobe, scene, expression, and energy.
- Design a clearly fictional companion identity spec (not a real-person likeness and not biometric identification intent).
- Ensure identity invariants are concrete and stable across canonical/gallery/chat generation.
- Push distinctness away from existing companion signatures while still fitting the chosen archetype.
- Diversify within archetype; avoid defaulting to the same glam/bombshell template.
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

const buildCapturePlan = (companion: VirtualGirlfriendCompanionRecord): CapturePlan[] => {
  const style = `${companion.archetype ?? ''} ${companion.tone ?? ''} ${companion.visual_aesthetic ?? ''} ${companion.affection_style ?? ''}`.toLowerCase();

  const personaSpecificLifestyle = /bombshell|glam|nightlife|bold/.test(style)
    ? {
        label: 'date-night glam look',
        environment: 'upscale evening venue or chic city backdrop',
        mood: 'playful confident date-night energy',
        wardrobe: 'dressy evening outfit with polished accessories',
        expression: 'confident smile with teasing eye contact',
        glamourLevel: 'high glamour',
      }
    : /intellectual|bookish|cozy|soft|calm/.test(style)
      ? {
          label: 'bookish cozy lifestyle',
          environment: 'warm cafe corner or home reading nook with texture',
          mood: 'soft understated romance',
          wardrobe: 'minimalist knit or cardigan with subtle elegance',
          expression: 'gentle half-smile and thoughtful gaze',
          glamourLevel: 'low-to-medium glamour',
        }
      : /playful|sporty|casual/.test(style)
        ? {
            label: 'daylight active lifestyle',
            environment: 'park, boardwalk, or casual outdoor city path',
            mood: 'fresh upbeat playful vibe',
            wardrobe: 'athleisure or casual sporty outfit',
            expression: 'energetic candid smile',
            glamourLevel: 'casual-fresh styling',
          }
        : {
            label: 'polished luxury lifestyle',
            environment: 'elegant hotel lounge or upscale modern interior',
            mood: 'poised romantic confidence',
            wardrobe: 'tailored refined outfit with clean lines',
            expression: 'composed warm confidence',
            glamourLevel: 'polished premium styling',
          };

  return [
    {
      kind: 'canonical',
      variantIndex: 0,
      label: 'signature portrait',
      framing: 'tight chest-up portrait, eye-level camera, strong face-first composition',
      environment: 'clean but scene-real background tied to selected aesthetic without clutter',
      mood: 'inviting chemistry with premium realism',
      wardrobe: 'signature look that defines her identity',
      expression: 'confident and warm eye contact',
      glamourLevel: 'balanced premium styling',
    },
    {
      kind: 'gallery',
      variantIndex: 1,
      label: 'lifestyle moment',
      framing: 'waist-up candid framing with visible activity and environment context',
      environment: 'lived-in daytime setting that feels personal and active',
      mood: 'candid and relaxed daily-life warmth',
      wardrobe: 'casual everyday outfit with movement-friendly styling',
      expression: 'easy natural smile while interacting with an object or activity',
      glamourLevel: 'low glamour casual realism',
    },
    {
      kind: 'gallery',
      variantIndex: 2,
      label: `date-night vibe — ${personaSpecificLifestyle.label}`,
      framing: 'half-body cinematic framing with intentional depth and clear subject separation',
      environment: personaSpecificLifestyle.environment,
      mood: personaSpecificLifestyle.mood,
      wardrobe: personaSpecificLifestyle.wardrobe,
      expression: personaSpecificLifestyle.expression,
      glamourLevel: personaSpecificLifestyle.glamourLevel,
    },
  ];
};

const buildImagePrompt = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  identityPack: VirtualGirlfriendVisualIdentityPack;
  capture: CapturePlan;
}) => {
  return [
    `Create a premium ${input.capture.label} image of the same single AI-generated woman identity named ${input.companion.name}.`,
    `Identity anchors: ${input.identityPack.continuityAnchors.join(', ')}.`,
    `Core look: ${input.identityPack.coreLookDescriptors.join(', ')}.`,
    `Identity invariants: age band ${input.identityPack.identityInvariants.ageBand}; face ${input.identityPack.identityInvariants.faceShape}; eyes ${input.identityPack.identityInvariants.eyeShapeColor}; brows ${input.identityPack.identityInvariants.browCharacter}; nose ${input.identityPack.identityInvariants.noseProfile}; lips ${input.identityPack.identityInvariants.lipShape}; skin tone ${input.identityPack.identityInvariants.skinToneBand}; hair ${input.identityPack.identityInvariants.hairSignature}; body presentation ${input.identityPack.identityInvariants.bodyPresentation}; signature motif ${input.identityPack.identityInvariants.signatureAccessoryOrMotif}.`,
    `Camera/composition preferences: ${input.identityPack.cameraCompositionPreferences.join(', ')}.`,
    `Framing: ${input.capture.framing}.`,
    `Background/environment: ${input.capture.environment}.`,
    `Wardrobe: ${input.capture.wardrobe}.`,
    `Expression and energy: ${input.capture.expression}; mood ${input.capture.mood}.`,
    `Glamour-to-casual level: ${input.capture.glamourLevel}.`,
    `Lighting/mood direction: ${input.identityPack.lightingMoodDirection}.`,
    `Realism target: ${input.identityPack.realismPolishLevel}; natural skin texture, true-to-life lighting, smartphone-photo authenticity.`,
    `Aesthetic context: ${input.companion.visual_aesthetic ?? 'premium romantic portrait aesthetic'}.`,
    'This companion must remain the same woman identity across all 3 total images in this set.',
    'Each slot must look like a different moment from her life, not alternate crops of the same scene.',
    'Do not repeat framing, camera angle, background, expression, or props from other slots.',
    'Must be meaningfully distinct from other variants in scene, framing, and styling while preserving the same identity.',
    'Keep dating-app appropriate, emotionally warm, and believable.',
    'Show exactly one adult woman, no extra people, no text overlays, no logos.',
    `Avoid: ${input.identityPack.negativeConstraints.join(', ')}.`,
    `Negative overlap cues: ${input.identityPack.negativeOverlapCues.join(', ')}.`,
  ].join(' ');
};

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export class VirtualGirlfriendImagePackError extends Error {
  canonicalImageId: string | null;

  constructor(message: string, canonicalImageId: string | null = null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VirtualGirlfriendImagePackError';
    this.canonicalImageId = canonicalImageId;
  }
}

export class VirtualGirlfriendCanonicalRegenerateError extends Error {
  canonicalImageId: string | null;

  constructor(message: string, canonicalImageId: string | null = null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VirtualGirlfriendCanonicalRegenerateError';
    this.canonicalImageId = canonicalImageId;
  }
}

const buildImageRecord = (input: {
  userId: string;
  companionId: string;
  visualProfileId: string;
  capture: CapturePlan;
  generated: {
    bytes: Buffer;
    mimeType: string;
    width: number | null;
    height: number | null;
    revisedPrompt: string | null;
    provider: 'ideogram';
    model: string;
    endpoint: string;
    requestId: string | null;
    jobId: string | null;
  };
  promptHash: string;
  identityPack: VirtualGirlfriendVisualIdentityPack;
  referenceImageId?: string;
}): Promise<Omit<VirtualGirlfriendCompanionImageRecord, 'id' | 'created_at'>> => {
  const key = `virtual-girlfriend-images/${input.userId}/${input.companionId}/${STYLE_VERSION}/${input.capture.kind}-${input.capture.variantIndex}-${Date.now()}.png`;

  return uploadToR2({
    key,
    body: input.generated.bytes,
    contentType: input.generated.mimeType,
  }).then(async (r2) => {
    const cloudinary = await uploadToCloudinary({
      bytes: input.generated.bytes,
      mimeType: input.generated.mimeType,
      folderPath: `${input.userId}/${input.companionId}`,
      publicId: `${STYLE_VERSION}-${input.capture.kind}-${input.capture.variantIndex}`,
    });

    return {
      user_id: input.userId,
      companion_id: input.companionId,
      visual_profile_id: input.visualProfileId,
      image_kind: input.capture.kind,
      variant_index: input.capture.variantIndex,
      origin_storage_provider: r2.provider,
      origin_storage_key: r2.key,
      origin_mime_type: input.generated.mimeType,
      origin_byte_size: input.generated.bytes.byteLength,
      delivery_provider: cloudinary.provider,
      delivery_public_id: cloudinary.publicId,
      delivery_url: cloudinary.deliveryUrl,
      width: cloudinary.width ?? input.generated.width,
      height: cloudinary.height ?? input.generated.height,
      prompt_hash: input.promptHash,
      style_version: STYLE_VERSION,
      seed_metadata: {},
      lineage_metadata: {
        generation_mode: input.capture.kind === 'canonical' ? 'canonical' : 'gallery_from_canonical',
        reference_image_id: input.referenceImageId ?? null,
        provider: input.generated.provider,
        providerModel: input.generated.model,
        providerEndpoint: input.generated.endpoint,
        providerRequestId: input.generated.requestId,
        providerJobId: input.generated.jobId,
        revisedPrompt: input.generated.revisedPrompt ?? null,
        continuityAnchors: input.identityPack.continuityAnchors,
        captureLabel: input.capture.label,
        captureMood: input.capture.mood,
        captureEnvironment: input.capture.environment,
      },
      moderation_status: 'pending',
      moderation: { provider: 'ideogram-v3' },
      provenance: {
        generatedBy: `${IDEOGRAM_PROVIDER}:V_3`,
        originalStorage: 'cloudflare_r2',
        delivery: 'cloudinary',
        generatedAt: new Date().toISOString(),
        providerEndpoint: input.generated.endpoint,
        providerRequestId: input.generated.requestId,
        providerJobId: input.generated.jobId,
      },
      quality_score: 0.92,
    };
  });
};

const downloadCanonicalReferenceBytes = async (canonicalDeliveryUrl: string) => {
  const response = await fetch(canonicalDeliveryUrl);
  if (!response.ok) {
    throw new Error(`Canonical reference download failed (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') ?? 'image/png',
  };
};

export const regenerateCanonicalForVisualProfile = async (input: {
  token: string;
  visualProfile: {
    id: string;
    user_id: string;
    companion_id: string;
    prompt_hash: string;
    identity_pack: VirtualGirlfriendVisualIdentityPack;
    canonical_reference_image_id: string | null;
    canonical_reference_metadata: Record<string, unknown>;
    canonical_review_status: 'pending' | 'approved' | 'rejected';
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
  };
  requestedBy: string;
  regenerateGallery: boolean;
}) => {
  const companion = await getVirtualGirlfriendCompanionById(
    input.token,
    input.visualProfile.user_id,
    input.visualProfile.companion_id,
  );

  if (!companion) {
    throw new VirtualGirlfriendCanonicalRegenerateError('Companion was not found for canonical regeneration.');
  }

  const captures = buildCapturePlan(companion);
  const canonicalCapture = captures.find((capture) => capture.kind === 'canonical');
  const galleryCaptures = captures.filter((capture) => capture.kind === 'gallery');

  if (!canonicalCapture) {
    throw new VirtualGirlfriendCanonicalRegenerateError('Canonical capture plan is missing.');
  }

  const canonicalPrompt = buildImagePrompt({
    companion,
    identityPack: input.visualProfile.identity_pack,
    capture: canonicalCapture,
  });

  const canonicalPromptHash = sha(
    `${input.visualProfile.prompt_hash}:regen:${Date.now()}:${canonicalCapture.kind}:${canonicalCapture.variantIndex}:${canonicalPrompt}`,
  );

  const canonicalGenerated = await generateCanonicalImageWithIdeogram(canonicalPrompt);
  const canonicalRow = await buildImageRecord({
    userId: input.visualProfile.user_id,
    companionId: input.visualProfile.companion_id,
    visualProfileId: input.visualProfile.id,
    capture: canonicalCapture,
    generated: canonicalGenerated,
    promptHash: canonicalPromptHash,
    identityPack: input.visualProfile.identity_pack,
  });

  const [canonicalImage] = await insertCompanionImages(input.token, [canonicalRow]);
  if (!canonicalImage) {
    throw new VirtualGirlfriendCanonicalRegenerateError('Canonical image persistence failed.');
  }

  const metadata = {
    ...(input.visualProfile.canonical_reference_metadata ?? {}),
    lastRegeneratedAt: new Date().toISOString(),
    regeneratedBy: input.requestedBy,
    previousCanonicalReferenceImageId: input.visualProfile.canonical_reference_image_id,
    previousReview: {
      status: input.visualProfile.canonical_review_status,
      reviewedBy: input.visualProfile.reviewed_by,
      reviewedAt: input.visualProfile.reviewed_at,
      reviewNotes: input.visualProfile.review_notes,
    },
  };

  await setCanonicalReferenceImageForVisualProfile(input.token, {
    userId: input.visualProfile.user_id,
    visualProfileId: input.visualProfile.id,
    canonicalReferenceImageId: canonicalImage.id,
    canonicalReferenceMetadata: metadata,
    canonicalReviewStatus: 'pending',
  });

  await setCanonicalReferenceImageId(
    input.token,
    input.visualProfile.user_id,
    input.visualProfile.companion_id,
    canonicalImage.id,
  );

  if (!input.regenerateGallery) {
    return { canonicalImage, galleryImages: [] as VirtualGirlfriendCompanionImageRecord[] };
  }

  try {
    const canonicalReference = await downloadCanonicalReferenceBytes(canonicalImage.delivery_url);
    const galleryRows: Array<Omit<VirtualGirlfriendCompanionImageRecord, 'id' | 'created_at'>> = [];

    for (const capture of galleryCaptures) {
      const prompt = buildImagePrompt({
        companion,
        identityPack: input.visualProfile.identity_pack,
        capture,
      });
      const promptHash = sha(`${input.visualProfile.prompt_hash}:regen:${capture.kind}:${capture.variantIndex}:${prompt}`);
      const generated = await generateGalleryImageFromReferenceWithIdeogram({
        prompt,
        referenceImageBytes: canonicalReference.bytes,
        referenceMimeType: canonicalReference.mimeType,
      });

      galleryRows.push(
        await buildImageRecord({
          userId: input.visualProfile.user_id,
          companionId: input.visualProfile.companion_id,
          visualProfileId: input.visualProfile.id,
          capture,
          generated,
          promptHash,
          identityPack: input.visualProfile.identity_pack,
          referenceImageId: canonicalImage.id,
        }),
      );
    }

    const galleryImages = galleryRows.length ? await insertCompanionImages(input.token, galleryRows) : [];
    return { canonicalImage, galleryImages };
  } catch (error) {
    throw new VirtualGirlfriendCanonicalRegenerateError(
      'Canonical regenerated, but gallery refresh from new canonical failed.',
      canonicalImage.id,
      { cause: error },
    );
  }
};

export const generateAndPersistVirtualGirlfriendImagePack = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  setup: {
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    preferenceHints?: string;
    selectedPortraitPrompt?: string;
    selectedPortraitImage?: string;
  };
}) => {
  const semanticSetup = resolveVisualIdentitySemanticInput({
    companion: input.companion,
    fallback: input.setup,
  });

  const allCompanions = await listVirtualGirlfriendCompanions(input.token, input.userId);
  const siblingCompanionSignatures = allCompanions
    .filter((companion) => companion.id !== input.companion.id)
    .slice(0, 8)
    .map((companion) => {
      const tags = companion.profile_tags?.slice(0, 4).join(', ') || 'no-tags';
      return `${companion.name}|${companion.archetype ?? 'n/a'}|${companion.visual_aesthetic ?? 'n/a'}|${tags}`;
    });

  const identityPack = await buildVisualIdentityPack({
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

  const promptBaseHash = sha(JSON.stringify(identityPack));
  const captures = buildCapturePlan(input.companion);
  const canonicalCapture = captures.find((capture) => capture.kind === 'canonical');
  const galleryCaptures = captures.filter((capture) => capture.kind === 'gallery');

  if (!canonicalCapture) {
    throw new VirtualGirlfriendImagePackError('Canonical capture plan is missing.');
  }

  const visualProfile = await createVisualProfile(input.token, {
    userId: input.userId,
    companionId: input.companion.id,
    styleVersion: STYLE_VERSION,
    promptHash: promptBaseHash,
    sourceSetup: semanticSetup,
    identityPack,
    continuityNotes: 'Identity continuity anchored by profile pack with varied scene plans for non-duplicate gallery outcomes.',
    moderationStatus: 'pending',
    provenance: { generatedBy: 'openai:gpt-5-mini', phase: 'stage9-phase3-refinement' },
  });

  const canonicalPrompt = buildImagePrompt({
    companion: input.companion,
    identityPack,
    capture: canonicalCapture,
  });
  const canonicalPromptHash = sha(`${promptBaseHash}:${canonicalCapture.kind}:${canonicalCapture.variantIndex}:${canonicalPrompt}`);

  const canonicalGenerated = await generateCanonicalImageWithIdeogram(canonicalPrompt);
  const canonicalRow = await buildImageRecord({
    userId: input.userId,
    companionId: input.companion.id,
    visualProfileId: visualProfile.id,
    capture: canonicalCapture,
    generated: canonicalGenerated,
    promptHash: canonicalPromptHash,
    identityPack,
  });

  const [canonicalImage] = await insertCompanionImages(input.token, [canonicalRow]);
  if (!canonicalImage) {
    throw new VirtualGirlfriendImagePackError('Canonical image persistence failed.');
  }

  try {
    const canonicalReference = await downloadCanonicalReferenceBytes(canonicalImage.delivery_url);
    const galleryRows: Array<Omit<VirtualGirlfriendCompanionImageRecord, 'id' | 'created_at'>> = [];

    for (const capture of galleryCaptures) {
      const prompt = buildImagePrompt({
        companion: input.companion,
        identityPack,
        capture,
      });
      const promptHash = sha(`${promptBaseHash}:${capture.kind}:${capture.variantIndex}:${prompt}`);
      const generated = await generateGalleryImageFromReferenceWithIdeogram({
        prompt,
        referenceImageBytes: canonicalReference.bytes,
        referenceMimeType: canonicalReference.mimeType,
      });

      galleryRows.push(
        await buildImageRecord({
          userId: input.userId,
          companionId: input.companion.id,
          visualProfileId: visualProfile.id,
          capture,
          generated,
          promptHash,
          identityPack,
          referenceImageId: canonicalImage.id,
        }),
      );
    }

    const galleryImages = galleryRows.length ? await insertCompanionImages(input.token, galleryRows) : [];

    return { visualProfile, images: [canonicalImage, ...galleryImages], canonicalImage };
  } catch (error) {
    throw new VirtualGirlfriendImagePackError('Gallery generation from canonical reference failed.', canonicalImage.id, {
      cause: error,
    });
  }
};
