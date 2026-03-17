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
  VirtualGirlfriendVisualIdentityPack,
} from '@/lib/virtual-girlfriend/types';
import { createVisualProfile, insertCompanionImages, setCanonicalReferenceImageForVisualProfile } from '@/lib/virtual-girlfriend/data';

const STYLE_VERSION = 'vg-image-v3';
const IDEOGRAM_PROVIDER = 'ideogram';

type BuildIdentityInput = {
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints?: string;
  companionName: string;
  persona: PersonaProfile;
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
  continuityAnchors: [...input.persona.visualPromptDNA.styleAnchors, input.companionName],
  negativeConstraints: [
    'avoid multiple people',
    'avoid distorted anatomy',
    'avoid low-resolution',
    'avoid plastic skin smoothing',
    'avoid repetitive same room composition',
    'avoid explicit nudity',
  ],
});

const sanitizePack = (raw: VirtualGirlfriendVisualIdentityPack, fallback: VirtualGirlfriendVisualIdentityPack) => ({
  ...fallback,
  ...raw,
  coreLookDescriptors: raw.coreLookDescriptors?.length ? raw.coreLookDescriptors : fallback.coreLookDescriptors,
  continuityAnchors: raw.continuityAnchors?.length ? raw.continuityAnchors : fallback.continuityAnchors,
  negativeConstraints: raw.negativeConstraints?.length ? raw.negativeConstraints : fallback.negativeConstraints,
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

Output JSON only with keys:
{
  "coreLookDescriptors": string[5..12],
  "portraitFramingStyle": string,
  "wardrobeDirection": string,
  "lightingMoodDirection": string,
  "realismPolishLevel": string,
  "continuityAnchors": string[5..14],
  "negativeConstraints": string[5..14]
}

Requirements:
- Strongly map archetype/tone/aesthetic to wardrobe, scene, expression, and energy.
- Prevent all outputs from collapsing into cozy indoor portraits.
- Prioritize realistic natural-lighting and believable phone-camera photography.
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
  };
}) => {
  const identityPack = await buildVisualIdentityPack({
    ...input.setup,
    companionName: input.companion.name,
    persona: input.companion.persona_profile,
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
    sourceSetup: input.setup,
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
