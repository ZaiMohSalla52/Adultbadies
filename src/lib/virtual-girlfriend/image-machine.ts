import crypto from 'node:crypto';
import {
  generateCanonicalImageFromReferenceWithIdeogram,
  generateCanonicalImageWithIdeogram,
  generatePortraitPreviewImageWithIdeogram,
  generateGalleryImageFromReferenceWithIdeogram,
  type IdeogramGeneratedImage,
} from '@/lib/virtual-girlfriend/image-ideogram';
import { uploadToCloudinary } from '@/lib/storage/cloudinary';
import { uploadToR2 } from '@/lib/storage/r2';
import {
  getVirtualGirlfriendCompanionById,
  insertCompanionImages,
  setCanonicalReferenceImageForVisualProfile,
} from '@/lib/virtual-girlfriend/data';
import type {
  VirtualGirlfriendChatImageOutcome,
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendVisualIdentityPack,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const STYLE_VERSION = 'vg-image-v3';
const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

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

export type VirtualGirlfriendImageMachineStatus =
  | 'ready'
  | 'partial_success'
  | 'failed'
  | 'blocked_pre_gen'
  | 'skipped_prerequisites'
  | 'reused_existing'
  | 'review_pending';

export type VirtualGirlfriendSetupMachineRequest = {
  kind: 'setup_pack';
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
};

export type VirtualGirlfriendRegenerateMachineRequest = {
  kind: 'regenerate';
  token: string;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
  requestedBy: string;
  regenerateGallery: boolean;
};

export type VirtualGirlfriendChatMachineRequest = {
  kind: 'chat_image';
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  category: VirtualGirlfriendImageCategory;
  existingImages: VirtualGirlfriendCompanionImageRecord[];
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
  allowFreshGeneration: boolean;
};

export type VirtualGirlfriendPortraitPreviewRequest = {
  kind: 'portrait_preview';
  sex?: string;
  origin?: string;
  hairColor?: string;
  figure?: string;
  age?: string;
  count?: number;
};

export type VirtualGirlfriendSetupMachineResult = {
  kind: 'setup_pack';
  status: 'ready' | 'partial_success';
  canonicalImage: VirtualGirlfriendCompanionImageRecord;
  galleryImages: VirtualGirlfriendCompanionImageRecord[];
};

export type VirtualGirlfriendRegenerateMachineResult = {
  kind: 'regenerate';
  status: 'ready' | 'partial_success';
  canonicalImage: VirtualGirlfriendCompanionImageRecord;
  galleryImages: VirtualGirlfriendCompanionImageRecord[];
};

export type VirtualGirlfriendChatMachineResult = {
  kind: 'chat_image';
  status: Extract<VirtualGirlfriendImageMachineStatus, 'reused_existing' | 'ready' | 'skipped_prerequisites' | 'failed'>;
  outcome: VirtualGirlfriendChatImageOutcome;
  attachment: VirtualGirlfriendMessageAttachment | null;
  reason?: string;
};

export type VirtualGirlfriendPortraitPreviewCandidate = {
  id: string;
  label: string;
  prompt: string;
  imageDataUrl: string;
};

export type VirtualGirlfriendPortraitPreviewResult = {
  kind: 'portrait_preview';
  status: 'ready';
  candidates: VirtualGirlfriendPortraitPreviewCandidate[];
};

const resolvePromptSubject = (sex: string | null | undefined) => {
  const normalized = (sex ?? '').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'man') return 'man';
  return 'woman';
};

const buildStructuredAppearanceContext = (companion: VirtualGirlfriendCompanionRecord) => {
  const structured = companion.structured_profile;
  if (!structured) return '';

  const cues = [
    structured.sex ? `sex: ${structured.sex}` : null,
    structured.age ? `age: ${structured.age}` : null,
    structured.origin ? `origin: ${structured.origin}` : null,
    structured.hairColor ? `hair: ${structured.hairColor}` : null,
    structured.figure ? `figure: ${structured.figure}` : null,
    structured.occupation ? `occupation vibe: ${structured.occupation}` : null,
    structured.personality ? `personality styling signal: ${structured.personality}` : null,
    structured.visualAesthetic ? `visual aesthetic: ${structured.visualAesthetic}` : null,
    structured.preferenceHints ? `user preference hints: ${structured.preferenceHints}` : null,
  ].filter(Boolean);

  return cues.length ? `Structured profile anchors: ${cues.join('; ')}.` : '';
};

const buildCapturePlan = (companion: VirtualGirlfriendCompanionRecord): CapturePlan[] => {
  const aesthetic = companion.visual_aesthetic?.toLowerCase() ?? '';
  const glam = aesthetic.includes('night') || aesthetic.includes('luxury');

  return [
    {
      kind: 'canonical',
      variantIndex: 0,
      label: 'canonical portrait',
      framing: 'close-up portrait, eye-level, natural perspective',
      environment: glam ? 'elevated interior with soft practical lights' : 'bright natural indoor setting',
      mood: 'warm magnetic confidence',
      wardrobe: glam ? 'elegant fitted look' : 'chic casual look',
      expression: 'inviting slight smile, emotionally present',
      glamourLevel: glam ? 'high but tasteful' : 'moderate natural polish',
    },
    {
      kind: 'gallery',
      variantIndex: 1,
      label: 'gallery lifestyle moment',
      framing: 'waist-up candid framing',
      environment: 'lifestyle location with depth and context',
      mood: 'playful relaxed charm',
      wardrobe: 'distinct daywear styling, polished but natural',
      expression: 'candid mid-conversation warmth',
      glamourLevel: 'balanced premium casual',
    },
    {
      kind: 'gallery',
      variantIndex: 2,
      label: 'gallery social moment',
      framing: 'half-body environmental composition',
      environment: glam ? 'night-out premium venue' : 'cozy golden-hour street scene',
      mood: 'flirty confident energy',
      wardrobe: glam ? 'statement evening styling' : 'styled smart-casual look',
      expression: 'confident direct gaze with subtle smile',
      glamourLevel: glam ? 'elevated glam' : 'refined lifestyle polish',
    },
  ];
};

const buildIdentityPrompt = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  identityPack: VirtualGirlfriendVisualIdentityPack;
  capture: CapturePlan;
}) => {
  const structuredAppearanceContext = buildStructuredAppearanceContext(input.companion);
  return [
    `Create a premium ${input.capture.label} image of the same single AI-generated ${resolvePromptSubject(input.companion.structured_profile?.sex)} identity named ${input.companion.name}.`,
    `Identity anchors: ${input.identityPack.continuityAnchors.join(', ')}.`,
    `Core look: ${input.identityPack.coreLookDescriptors.join(', ')}.`,
    structuredAppearanceContext,
    `Identity invariants: age band ${input.identityPack.identityInvariants.ageBand}; face ${input.identityPack.identityInvariants.faceShape}; eyes ${input.identityPack.identityInvariants.eyeShapeColor}; brows ${input.identityPack.identityInvariants.browCharacter}; nose ${input.identityPack.identityInvariants.noseProfile}; lips ${input.identityPack.identityInvariants.lipShape}; skin tone ${input.identityPack.identityInvariants.skinToneBand}; hair ${input.identityPack.identityInvariants.hairSignature}; body presentation ${input.identityPack.identityInvariants.bodyPresentation}; signature motif ${input.identityPack.identityInvariants.signatureAccessoryOrMotif}.`,
    `Wardrobe direction system-wide: ${input.identityPack.wardrobeDirection}.`,
    `Camera/composition preferences: ${input.identityPack.cameraCompositionPreferences.join(', ')}.`,
    `Framing: ${input.capture.framing}. Background/environment: ${input.capture.environment}.`,
    `Wardrobe: ${input.capture.wardrobe}. Expression and energy: ${input.capture.expression}; mood ${input.capture.mood}.`,
    `Lighting/mood direction: ${input.identityPack.lightingMoodDirection}. Realism target: ${input.identityPack.realismPolishLevel}.`,
    `Show exactly one adult ${resolvePromptSubject(input.companion.structured_profile?.sex)}, no extra people, no text overlays, no logos.`,
    `Avoid: ${input.identityPack.negativeConstraints.join(', ')}.`,
    `Negative overlap cues: ${input.identityPack.negativeOverlapCues.join(', ')}.`,
  ].join(' ');
};

const buildChatPrompt = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
  category: VirtualGirlfriendImageCategory;
}) => {
  const identityPack = input.visualProfile.identity_pack;
  return [
    `Generate a premium ${input.category} chat photo of the same single AI-generated ${resolvePromptSubject(input.companion.structured_profile?.sex)} identity named ${input.companion.name}.`,
    `Continuity anchors: ${identityPack.continuityAnchors.join(', ')}.`,
    `Core look descriptors: ${identityPack.coreLookDescriptors.join(', ')}.`,
    `Camera/composition preferences: ${identityPack.cameraCompositionPreferences.join(', ')}.`,
    `Wardrobe direction: ${identityPack.wardrobeDirection}. Lighting direction: ${identityPack.lightingMoodDirection}.`,
    'Ensure this image is not a near-duplicate of previous images; vary scene, angle, and outfit while preserving identity.',
    `Avoid: ${identityPack.negativeConstraints.join(', ')}.`,
  ].join(' ');
};

const buildPortraitPreviewPrompt = (input: {
  sex?: string;
  origin?: string;
  hairColor?: string;
  figure?: string;
  age?: string;
  variant: number;
}) => [
  `Generate exactly one adult ${resolvePromptSubject(input.sex)} for a dating-profile portrait preview.`,
  'Strict composition: one woman only, solo portrait only, single subject only, centered in frame.',
  'Framing: vertical 3:4 head-and-shoulders or bust portrait, eye-level camera, realistic phone-camera photo style.',
  'Pose: looking at camera or natural portrait pose; clean uncluttered background with no extra faces or people.',
  `Origin cue: ${input.origin ?? 'mixed'}.`,
  `Hair cue: ${input.hairColor ?? 'natural'}.`,
  `Body presentation cue: ${input.figure ?? 'balanced'}.`,
  `Age cue: ${input.age ?? 'mid-20s'}.`,
  `Variant mood ${input.variant + 1}: subtle expression change and wardrobe color variation while preserving one-person portrait framing.`,
  'Hard negatives: no second person, no duplicated subject, no twin, no mirrored composition, no reflection clone, no diptych, no collage, no split screen, no side-by-side layout, no multi-panel frame, no background person, no extra face.',
  'No text, no watermark, no logos, no explicit nudity.',
].join(' ');

const parseDataUrlImage = (dataUrl: string): { bytes: Buffer; mimeType: string } | null => {
  const matched = dataUrl.trim().match(/^data:(.+?);base64,(.+)$/);
  if (!matched) return null;
  try {
    return { mimeType: matched[1] ?? 'image/png', bytes: Buffer.from(matched[2] ?? '', 'base64') };
  } catch {
    return null;
  }
};

const toDataUrl = (bytes: Buffer, mimeType: string) => `data:${mimeType};base64,${bytes.toString('base64')}`;

const downloadReferenceBytes = async (deliveryUrl: string, fallbackMimeType?: string | null) => {
  const response = await fetch(deliveryUrl);
  if (!response.ok) throw new Error(`Reference download failed (${response.status}).`);
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') ?? fallbackMimeType ?? 'image/png',
  };
};

const buildImageRecord = async (input: {
  token: string;
  userId: string;
  companionId: string;
  visualProfileId: string;
  promptHash: string;
  capture: CapturePlan;
  generated: IdeogramGeneratedImage;
  identityPack: VirtualGirlfriendVisualIdentityPack;
  referenceImageId?: string;
  lineageExtra?: Record<string, unknown>;
}) => {
  const key = `virtual-girlfriend-images/${input.userId}/${input.companionId}/${STYLE_VERSION}/${input.capture.kind}-${input.capture.variantIndex}-${Date.now()}.png`;
  const r2 = await uploadToR2({ key, body: input.generated.bytes, contentType: input.generated.mimeType });
  const cloudinary = await uploadToCloudinary({
    bytes: input.generated.bytes,
    mimeType: input.generated.mimeType,
    folderPath: `${input.userId}/${input.companionId}`,
    publicId: `${STYLE_VERSION}-${input.capture.kind}-${input.capture.variantIndex}-${Date.now()}`,
  });

  const [inserted] = await insertCompanionImages(input.token, [{
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
      provider: 'ideogram',
      provider_model: input.generated.model,
      provider_request_id: input.generated.requestId,
      provider_job_id: input.generated.jobId,
      revisedPrompt: input.generated.revisedPrompt,
      ...input.lineageExtra,
    },
    moderation_status: 'pending',
    moderation: { provider: 'ideogram-v3' },
    provenance: {
      generatedBy: `ideogram:${input.generated.model}`,
      generatedAt: new Date().toISOString(),
      providerEndpoint: input.generated.endpoint,
    },
    quality_score: 0.92,
  }]);

  if (!inserted) throw new Error('Image persistence failed after upload.');
  return inserted;
};

const pickReusableImage = (category: VirtualGirlfriendImageCategory, images: VirtualGirlfriendCompanionImageRecord[]) => {
  const newestFirst = [...images].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const exact = newestFirst.find((image) => image.lineage_metadata?.chatCategory === category);
  if (exact) return exact;
  return newestFirst.find((image) => image.image_kind === 'gallery' || image.image_kind === 'canonical') ?? null;
};

const resolveCanonicalReference = (
  visualProfile: VirtualGirlfriendVisualProfileRecord,
  existingImages: VirtualGirlfriendCompanionImageRecord[],
) => {
  const canonicalId = visualProfile.canonical_reference_image_id;
  if (!canonicalId) return null;
  return existingImages.find((image) => image.id === canonicalId) ?? null;
};

const generateGalleryFromCanonical = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
  canonicalImage: VirtualGirlfriendCompanionImageRecord;
}) => {
  const captures = buildCapturePlan(input.companion).filter((entry) => entry.kind === 'gallery');
  const canonicalRef = await downloadReferenceBytes(input.canonicalImage.delivery_url, input.canonicalImage.origin_mime_type);
  const galleryImages: VirtualGirlfriendCompanionImageRecord[] = [];

  for (const capture of captures) {
    const prompt = buildIdentityPrompt({ companion: input.companion, identityPack: input.visualProfile.identity_pack, capture });
    const generated = await generateGalleryImageFromReferenceWithIdeogram({
      prompt,
      referenceImageBytes: canonicalRef.bytes,
      referenceMimeType: canonicalRef.mimeType,
    });

    const galleryImage = await buildImageRecord({
      token: input.token,
      userId: input.userId,
      companionId: input.companion.id,
      visualProfileId: input.visualProfile.id,
      promptHash: sha(`${input.visualProfile.prompt_hash}:gallery:${capture.variantIndex}:${prompt}`),
      capture,
      generated,
      identityPack: input.visualProfile.identity_pack,
      referenceImageId: input.canonicalImage.id,
    });

    galleryImages.push(galleryImage);
  }

  return galleryImages;
};

export class VirtualGirlfriendImagePackError extends Error {
  constructor(message: string, public canonicalImageId: string | null = null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VirtualGirlfriendImagePackError';
  }
}

export class VirtualGirlfriendCanonicalRegenerateError extends Error {
  constructor(message: string, public canonicalImageId: string | null = null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VirtualGirlfriendCanonicalRegenerateError';
  }
}

export const runSetupImageMachine = async (input: VirtualGirlfriendSetupMachineRequest): Promise<VirtualGirlfriendSetupMachineResult> => {
  const captures = buildCapturePlan(input.companion);
  const canonicalCapture = captures.find((capture) => capture.kind === 'canonical');
  if (!canonicalCapture) throw new VirtualGirlfriendImagePackError('Canonical capture plan is missing.');

  const canonicalPrompt = buildIdentityPrompt({ companion: input.companion, identityPack: input.visualProfile.identity_pack, capture: canonicalCapture });
  const seedPortraitDataUrl = typeof input.visualProfile.source_setup?.selectedPortraitImage === 'string'
    ? input.visualProfile.source_setup.selectedPortraitImage
    : null;
  const seedPortrait = seedPortraitDataUrl ? parseDataUrlImage(seedPortraitDataUrl) : null;

  const canonicalGenerated = seedPortrait
    ? await generateCanonicalImageFromReferenceWithIdeogram({ prompt: canonicalPrompt, referenceImageBytes: seedPortrait.bytes, referenceMimeType: seedPortrait.mimeType, imageWeight: 93 })
    : await generateCanonicalImageWithIdeogram(canonicalPrompt);

  const canonicalImage = await buildImageRecord({
    token: input.token,
    userId: input.userId,
    companionId: input.companion.id,
    visualProfileId: input.visualProfile.id,
    promptHash: sha(`${input.visualProfile.prompt_hash}:canonical:${canonicalPrompt}`),
    capture: canonicalCapture,
    generated: canonicalGenerated,
    identityPack: input.visualProfile.identity_pack,
  });

  try {
    const galleryImages = await generateGalleryFromCanonical({
      token: input.token,
      userId: input.userId,
      companion: input.companion,
      visualProfile: input.visualProfile,
      canonicalImage,
    });

    return { kind: 'setup_pack', status: 'ready', canonicalImage, galleryImages };
  } catch (error) {
    throw new VirtualGirlfriendImagePackError('Gallery generation from canonical reference failed.', canonicalImage.id, { cause: error });
  }
};

const runRegenerateImageMachine = async (input: VirtualGirlfriendRegenerateMachineRequest): Promise<VirtualGirlfriendRegenerateMachineResult> => {
  const companion = await getVirtualGirlfriendCompanionById(input.token, input.visualProfile.user_id, input.visualProfile.companion_id);
  if (!companion) throw new VirtualGirlfriendCanonicalRegenerateError('Companion was not found for canonical regeneration.');

  const captures = buildCapturePlan(companion);
  const canonicalCapture = captures.find((capture) => capture.kind === 'canonical');
  if (!canonicalCapture) throw new VirtualGirlfriendCanonicalRegenerateError('Canonical capture plan is missing.');

  const canonicalPrompt = buildIdentityPrompt({ companion, identityPack: input.visualProfile.identity_pack, capture: canonicalCapture });
  const seedPortraitDataUrl = typeof input.visualProfile.source_setup?.selectedPortraitImage === 'string'
    ? input.visualProfile.source_setup.selectedPortraitImage
    : null;
  const seedPortrait = seedPortraitDataUrl ? parseDataUrlImage(seedPortraitDataUrl) : null;

  const canonicalGenerated = seedPortrait
    ? await generateCanonicalImageFromReferenceWithIdeogram({ prompt: canonicalPrompt, referenceImageBytes: seedPortrait.bytes, referenceMimeType: seedPortrait.mimeType, imageWeight: 90 })
    : await generateCanonicalImageWithIdeogram(canonicalPrompt);

  const canonicalImage = await buildImageRecord({
    token: input.token,
    userId: input.visualProfile.user_id,
    companionId: companion.id,
    visualProfileId: input.visualProfile.id,
    promptHash: sha(`${input.visualProfile.prompt_hash}:regen:canonical:${canonicalPrompt}`),
    capture: canonicalCapture,
    generated: canonicalGenerated,
    identityPack: input.visualProfile.identity_pack,
  });

  let galleryImages: VirtualGirlfriendCompanionImageRecord[] = [];
  if (input.regenerateGallery) {
    try {
      galleryImages = await generateGalleryFromCanonical({
        token: input.token,
        userId: input.visualProfile.user_id,
        companion,
        visualProfile: input.visualProfile,
        canonicalImage,
      });
    } catch (error) {
      throw new VirtualGirlfriendCanonicalRegenerateError('Canonical regenerated, but gallery refresh from new canonical failed.', canonicalImage.id, { cause: error });
    }
  }

  await setCanonicalReferenceImageForVisualProfile(input.token, {
    userId: input.visualProfile.user_id,
    visualProfileId: input.visualProfile.id,
    canonicalReferenceImageId: canonicalImage.id,
    canonicalReferenceMetadata: {
      lastRegeneratedAt: new Date().toISOString(),
      regeneratedBy: input.requestedBy,
      previousCanonicalReferenceImageId: input.visualProfile.canonical_reference_image_id,
    },
    canonicalReviewStatus: 'pending',
  });

  return {
    kind: 'regenerate',
    status: galleryImages.length > 0 || !input.regenerateGallery ? 'ready' : 'partial_success',
    canonicalImage,
    galleryImages,
  };
};

export const runRegenerateCanonicalOnlyImageMachine = async (
  input: Omit<VirtualGirlfriendRegenerateMachineRequest, 'kind' | 'regenerateGallery'>,
) => runRegenerateImageMachine({ kind: 'regenerate', ...input, regenerateGallery: false });

export const runRegenerateCanonicalWithGalleryImageMachine = async (
  input: Omit<VirtualGirlfriendRegenerateMachineRequest, 'kind' | 'regenerateGallery'>,
) => runRegenerateImageMachine({ kind: 'regenerate', ...input, regenerateGallery: true });

export const runChatImageMachine = async (input: VirtualGirlfriendChatMachineRequest): Promise<VirtualGirlfriendChatMachineResult> => {
  const reusable = pickReusableImage(input.category, input.existingImages);
  if (reusable) {
    return {
      kind: 'chat_image',
      status: 'reused_existing',
      outcome: 'reused_existing',
      attachment: {
        kind: 'image',
        category: input.category,
        imageId: reusable.id,
        imageUrl: reusable.delivery_url,
        width: reusable.width,
        height: reusable.height,
        source: 'gallery-reuse',
        promptHash: reusable.prompt_hash,
      },
    };
  }

  if (!input.allowFreshGeneration || !input.visualProfile) {
    return {
      kind: 'chat_image',
      status: 'skipped_prerequisites',
      outcome: 'skipped_prerequisites',
      attachment: null,
      reason: !input.allowFreshGeneration ? 'fresh_generation_not_allowed' : 'visual_profile_missing',
    };
  }

  const canonical = resolveCanonicalReference(input.visualProfile, input.existingImages);
  if (!canonical?.delivery_url) {
    return {
      kind: 'chat_image',
      status: 'skipped_prerequisites',
      outcome: 'skipped_prerequisites',
      attachment: null,
      reason: 'canonical_reference_missing',
    };
  }

  try {
    const reference = await downloadReferenceBytes(canonical.delivery_url, canonical.origin_mime_type);
    const prompt = buildChatPrompt({ companion: input.companion, visualProfile: input.visualProfile, category: input.category });
    const generated = await generateGalleryImageFromReferenceWithIdeogram({
      prompt,
      referenceImageBytes: reference.bytes,
      referenceMimeType: reference.mimeType,
    });

    const chatImage = await buildImageRecord({
      token: input.token,
      userId: input.userId,
      companionId: input.companion.id,
      visualProfileId: input.visualProfile.id,
      promptHash: sha(`${input.visualProfile.prompt_hash}:chat:${input.category}:${prompt}`),
      capture: {
        kind: 'gallery',
        variantIndex: Math.floor(Math.random() * 100000),
        label: `chat ${input.category}`,
        framing: 'chat-shot',
        environment: 'contextual',
        mood: 'warm',
        wardrobe: 'varied',
        expression: 'natural',
        glamourLevel: 'balanced',
      },
      generated,
      identityPack: input.visualProfile.identity_pack,
      referenceImageId: canonical.id,
      lineageExtra: {
        generation_mode: 'chat_from_canonical',
        chatCategory: input.category,
        source: 'chat-image-machine',
      },
    });

    return {
      kind: 'chat_image',
      status: 'ready',
      outcome: 'generated_new',
      attachment: {
        kind: 'image',
        category: input.category,
        imageId: chatImage.id,
        imageUrl: chatImage.delivery_url,
        width: chatImage.width,
        height: chatImage.height,
        source: 'fresh-generation',
        promptHash: chatImage.prompt_hash,
      },
    };
  } catch (error) {
    return {
      kind: 'chat_image',
      status: 'failed',
      outcome: 'failed_generation',
      attachment: null,
      reason: error instanceof Error ? error.message : 'chat_generation_failed',
    };
  }
};

export const runPortraitPreviewImageMachine = async (
  input: VirtualGirlfriendPortraitPreviewRequest,
): Promise<VirtualGirlfriendPortraitPreviewResult> => {
  const count = Math.min(Math.max(input.count ?? 4, 1), 8);
  const candidates = await Promise.all(
    Array.from({ length: count }).map(async (_, index) => {
      const prompt = buildPortraitPreviewPrompt({ ...input, variant: index });
      const generated = await generatePortraitPreviewImageWithIdeogram(prompt);
      return {
        id: `candidate-${index + 1}`,
        label: `Candidate ${index + 1}`,
        prompt,
        imageDataUrl: toDataUrl(generated.bytes, generated.mimeType),
      } satisfies VirtualGirlfriendPortraitPreviewCandidate;
    }),
  );

  return { kind: 'portrait_preview', status: 'ready', candidates };
};
