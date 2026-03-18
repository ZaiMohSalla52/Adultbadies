import crypto from 'node:crypto';
import {
  generateCanonicalImageFromReferenceWithIdeogram,
  generateCanonicalImageWithIdeogram,
  generatePortraitPreviewImageWithIdeogram,
  generatePreviewWithCharacterReference,
  generateGalleryImageFromReferenceWithIdeogram,
  generateChatImageFromReferenceWithIdeogram,
  type IdeogramGeneratedImage,
} from '@/lib/virtual-girlfriend/image-ideogram';
import { buildRegeneratePrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/regenerate';
import { buildPreviewPrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/preview';
import { PROMPT_VERSION } from '@/lib/virtual-girlfriend/prompt-builder/versions';
import { uploadToCloudinary } from '@/lib/storage/cloudinary';
import { uploadToR2 } from '@/lib/storage/r2';
import {
  getVirtualGirlfriendCompanionById,
  insertCompanionImages,
  setCanonicalReferenceImageForVisualProfile,
} from '@/lib/virtual-girlfriend/data';
import type { PreviewTraits } from '@/lib/virtual-girlfriend/types/traits';
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

const MACHINE_TIMEOUT_MS = {
  providerRequest: 28_000,
  download: 15_000,
  storageUpload: 20_000,
} as const;

const MACHINE_RETRY_ATTEMPTS = {
  providerRequest: 2,
  download: 2,
  storageUpload: 2,
} as const;

export type VirtualGirlfriendMachineFailureReason =
  | 'missing_prerequisites'
  | 'provider_error'
  | 'provider_timeout'
  | 'download_error'
  | 'storage_error'
  | 'persistence_error'
  | 'invalid_reference'
  | 'no_reusable_image';

type MachineErrorStage =
  | 'provider_request'
  | 'reference_download'
  | 'storage_upload'
  | 'persistence'
  | 'prerequisites'
  | 'reuse_selection';

class VirtualGirlfriendImageMachineError extends Error {
  constructor(
    message: string,
    public reason: VirtualGirlfriendMachineFailureReason,
    public stage: MachineErrorStage,
    public retriable = false,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'VirtualGirlfriendImageMachineError';
  }
}

const logImageMachine = (scope: string, event: string, details: Record<string, unknown>) => {
  console.info(`[virtual-girlfriend][image-machine][${scope}] ${event}`, details);
};

const withTimeout = async <T>(label: string, timeoutMs: number, run: () => Promise<T>) => {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const isTransientError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('timeout') || message.includes('429') || message.includes('503') || message.includes('502') || message.includes('network');
};

const withRetries = async <T>(input: {
  attempts: number;
  scope: string;
  stage: MachineErrorStage;
  reason: VirtualGirlfriendMachineFailureReason;
  run: () => Promise<T>;
}) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= input.attempts; attempt += 1) {
    try {
      return await input.run();
    } catch (error) {
      lastError = error;
      const retryable = isTransientError(error) && attempt < input.attempts;
      logImageMachine(input.scope, 'stage_failure', { stage: input.stage, reason: input.reason, attempt, retryable });
      if (!retryable) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  if (lastError instanceof VirtualGirlfriendImageMachineError) {
    throw lastError;
  }

  throw new VirtualGirlfriendImageMachineError(
    lastError instanceof Error ? lastError.message : `${input.stage}_failed`,
    input.reason,
    input.stage,
    false,
    { cause: lastError },
  );
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
  count?: number;
} & PreviewTraits & {
    skinTone?: string;
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
  promptVersion: typeof PROMPT_VERSION.preview;
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

  const normalizedStyleVibe = structured.styleVibe?.trim().toLowerCase();
  const styleVibeDescriptor = (() => {
    if (!normalizedStyleVibe || normalizedStyleVibe === 'unknown') return null;
    if (normalizedStyleVibe === 'casual') return 'casual everyday style';
    if (normalizedStyleVibe === 'elegant') return 'elegant polished style';
    if (normalizedStyleVibe === 'edgy') return 'edgy streetwear style';
    if (normalizedStyleVibe === 'bohemian') return 'relaxed bohemian style';
    if (normalizedStyleVibe === 'sporty') return 'athletic sporty style';
    if (normalizedStyleVibe === 'professional') return 'professional composed style';
    return structured.styleVibe?.trim() ?? null;
  })();

  const hairDescriptor = (() => {
    const hairColor = structured.hairColor?.trim();
    const hairLength = structured.hairLength?.trim();
    if (hairColor && hairLength) return `${hairColor} ${hairLength} hair`;
    if (hairColor) return `${hairColor} hair`;
    if (hairLength) return `${hairLength} hair`;
    return null;
  })();

  const bodyDescriptor = structured.bodyType?.trim() || structured.figure?.trim() || null;

  const cues = [
    structured.sex ? `sex: ${structured.sex}` : null,
    structured.age ? `age: ${structured.age}` : null,
    structured.origin ? `origin: ${structured.origin}` : null,
    hairDescriptor ? `hair: ${hairDescriptor}` : null,
    structured.eyeColor ? `eyes: ${structured.eyeColor.trim()} eyes` : null,
    structured.skinTone ? `complexion: ${structured.skinTone.trim()} skin tone` : null,
    bodyDescriptor ? `figure: ${bodyDescriptor}` : null,
    styleVibeDescriptor ? `style vibe: ${styleVibeDescriptor}` : null,
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

const downloadReferenceBytes = async (input: {
  scope: string;
  deliveryUrl: string;
  fallbackMimeType?: string | null;
}) => withRetries({
  attempts: MACHINE_RETRY_ATTEMPTS.download,
  scope: input.scope,
  stage: 'reference_download',
  reason: 'download_error',
  run: async () => {
    const response = await withTimeout('reference_download', MACHINE_TIMEOUT_MS.download, () => fetch(input.deliveryUrl));
    if (!response.ok) throw new Error(`Reference download failed (${response.status}).`);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (!bytes.byteLength) {
      throw new VirtualGirlfriendImageMachineError('Reference bytes were empty.', 'invalid_reference', 'reference_download');
    }
    return {
      bytes,
      mimeType: response.headers.get('content-type') ?? input.fallbackMimeType ?? 'image/png',
    };
  },
});

const runProviderGeneration = async (input: {
  scope: string;
  mode: 'canonical' | 'canonical_from_reference' | 'gallery_from_reference' | 'chat_from_reference';
  prompt: string;
  referenceImageBytes?: Buffer;
  referenceMimeType?: string;
  imageWeight?: number;
}) => {
  logImageMachine(input.scope, 'provider_call_start', { mode: input.mode });
  const run = async () => {
    if (input.mode === 'canonical') {
      return withTimeout('provider_generation', MACHINE_TIMEOUT_MS.providerRequest, () => generateCanonicalImageWithIdeogram(input.prompt));
    }

    if (!input.referenceImageBytes || !input.referenceMimeType) {
      throw new VirtualGirlfriendImageMachineError('Reference bytes missing for provider reference generation.', 'invalid_reference', 'prerequisites');
    }

    const referenceImageBytes = input.referenceImageBytes;
    const referenceMimeType = input.referenceMimeType;

    if (input.mode === 'canonical_from_reference') {
      return withTimeout('provider_generation', MACHINE_TIMEOUT_MS.providerRequest, () => generateCanonicalImageFromReferenceWithIdeogram({
        prompt: input.prompt,
        referenceImageBytes,
        referenceMimeType,
        imageWeight: input.imageWeight,
      }));
    }

    const generateFromReference = input.mode === 'gallery_from_reference'
      ? generateGalleryImageFromReferenceWithIdeogram
      : generateChatImageFromReferenceWithIdeogram;

    return withTimeout('provider_generation', MACHINE_TIMEOUT_MS.providerRequest, () => generateFromReference({
      prompt: input.prompt,
      referenceImageBytes,
      referenceMimeType,
    }));
  };

  try {
    const generated = await withRetries({
      attempts: MACHINE_RETRY_ATTEMPTS.providerRequest,
      scope: input.scope,
      stage: 'provider_request',
      reason: 'provider_error',
      run,
    });
    logImageMachine(input.scope, 'provider_call_success', { mode: input.mode });
    return generated;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('provider_generation_timeout')) {
      throw new VirtualGirlfriendImageMachineError('Provider request timed out.', 'provider_timeout', 'provider_request', true, { cause: error });
    }
    throw error;
  }
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
  promptText: string;
  promptVersion: string;
  surfaceType: string;
  scope: string;
}) => {
  const key = `virtual-girlfriend-images/${input.userId}/${input.companionId}/${STYLE_VERSION}/${input.capture.kind}-${input.capture.variantIndex}-${Date.now()}.png`;

  logImageMachine(input.scope, 'upload_start', { target: 'r2', key });
  const r2 = await withRetries({
    attempts: MACHINE_RETRY_ATTEMPTS.storageUpload,
    scope: input.scope,
    stage: 'storage_upload',
    reason: 'storage_error',
    run: () => withTimeout('r2_upload', MACHINE_TIMEOUT_MS.storageUpload, () => uploadToR2({ key, body: input.generated.bytes, contentType: input.generated.mimeType })),
  });

  logImageMachine(input.scope, 'upload_success', { target: 'r2', key: r2.key });

  logImageMachine(input.scope, 'upload_start', { target: 'cloudinary' });
  const cloudinary = await withRetries({
    attempts: MACHINE_RETRY_ATTEMPTS.storageUpload,
    scope: input.scope,
    stage: 'storage_upload',
    reason: 'storage_error',
    run: () => withTimeout('cloudinary_upload', MACHINE_TIMEOUT_MS.storageUpload, () => uploadToCloudinary({
      bytes: input.generated.bytes,
      mimeType: input.generated.mimeType,
      folderPath: `${input.userId}/${input.companionId}`,
      publicId: `${STYLE_VERSION}-${input.capture.kind}-${input.capture.variantIndex}-${Date.now()}`,
    })),
  });

  logImageMachine(input.scope, 'upload_success', { target: 'cloudinary', publicId: cloudinary.publicId });

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
    promptText: input.promptText,
    promptVersion: input.promptVersion,
    surfaceType: input.surfaceType,
  }]);

  if (!inserted) {
    logImageMachine(input.scope, 'persistence_failure', { reason: 'persistence_error' });
    throw new VirtualGirlfriendImageMachineError('Image persistence failed after upload.', 'persistence_error', 'persistence');
  }
  logImageMachine(input.scope, 'persistence_success', { imageId: inserted.id });
  return inserted;
};

const pickReusableImage = (category: VirtualGirlfriendImageCategory, images: VirtualGirlfriendCompanionImageRecord[]) => {
  const eligible = images.filter((image) => image.delivery_url && (image.image_kind === 'gallery' || image.image_kind === 'canonical'));
  if (!eligible.length) {
    return { image: null, reason: 'no_reusable_image' as const };
  }

  const newestFirst = [...eligible].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const exactCategory = newestFirst.find((image) => image.lineage_metadata?.chatCategory === category);
  if (exactCategory) return { image: exactCategory, reason: null };

  const closestCategory = newestFirst.find((image) => {
    const chatCategory = image.lineage_metadata?.chatCategory;
    return chatCategory && (chatCategory === category || (category === 'selfie' && image.image_kind === 'canonical'));
  });

  if (closestCategory) return { image: closestCategory, reason: null };
  return { image: newestFirst[0] ?? null, reason: null };
};

const resolveCanonicalReference = (
  visualProfile: VirtualGirlfriendVisualProfileRecord,
  existingImages: VirtualGirlfriendCompanionImageRecord[],
) => {
  const canonicalId = visualProfile.canonical_reference_image_id;
  if (!canonicalId) {
    throw new VirtualGirlfriendImageMachineError('Canonical reference id is missing.', 'missing_prerequisites', 'prerequisites');
  }

  const canonical = existingImages.find((image) => image.id === canonicalId);
  if (!canonical) {
    throw new VirtualGirlfriendImageMachineError('Canonical reference id does not match existing images.', 'invalid_reference', 'prerequisites');
  }

  if (!canonical.delivery_url) {
    throw new VirtualGirlfriendImageMachineError('Canonical reference image is missing delivery URL.', 'missing_prerequisites', 'prerequisites');
  }

  return canonical;
};

const generateGalleryFromCanonical = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
  canonicalImage: VirtualGirlfriendCompanionImageRecord;
  scope: string;
}) => {
  const captures = buildCapturePlan(input.companion).filter((entry) => entry.kind === 'gallery');
  const canonicalRef = await downloadReferenceBytes({
    scope: input.scope,
    deliveryUrl: input.canonicalImage.delivery_url,
    fallbackMimeType: input.canonicalImage.origin_mime_type,
  });
  const galleryImages: VirtualGirlfriendCompanionImageRecord[] = [];

  for (const capture of captures) {
    const prompt = buildIdentityPrompt({ companion: input.companion, identityPack: input.visualProfile.identity_pack, capture });
    const generated = await runProviderGeneration({
      scope: input.scope,
      mode: 'gallery_from_reference',
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
      promptText: prompt,
      promptVersion: PROMPT_VERSION.gallery,
      surfaceType: 'gallery',
      scope: input.scope,
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
  const scope = 'setup_pack';
  logImageMachine(scope, 'request_start', { companionId: input.companion.id, visualProfileId: input.visualProfile.id });
  const captures = buildCapturePlan(input.companion);
  const canonicalCapture = captures.find((capture) => capture.kind === 'canonical');
  if (!canonicalCapture) throw new VirtualGirlfriendImagePackError('Canonical capture plan is missing.');

  const canonicalPrompt = buildIdentityPrompt({ companion: input.companion, identityPack: input.visualProfile.identity_pack, capture: canonicalCapture });
  const seedPortraitDataUrl = typeof input.visualProfile.source_setup?.selectedPortraitImage === 'string'
    ? input.visualProfile.source_setup.selectedPortraitImage
    : null;

  if (seedPortraitDataUrl && !parseDataUrlImage(seedPortraitDataUrl)) {
    throw new VirtualGirlfriendImagePackError('Selected portrait reference is invalid data URL.', null, {
      cause: new VirtualGirlfriendImageMachineError('Selected portrait data URL cannot be decoded.', 'invalid_reference', 'prerequisites'),
    });
  }

  const seedPortrait = seedPortraitDataUrl ? parseDataUrlImage(seedPortraitDataUrl) : null;
  logImageMachine(scope, 'reference_resolved', { hasSeedPortrait: Boolean(seedPortrait) });

  const canonicalGenerated = await runProviderGeneration({
    scope,
    mode: seedPortrait ? 'canonical_from_reference' : 'canonical',
    prompt: canonicalPrompt,
    referenceImageBytes: seedPortrait?.bytes,
    referenceMimeType: seedPortrait?.mimeType,
    imageWeight: 93,
  });
  logImageMachine(scope, 'provider_call_success', { stage: 'canonical' });

  const canonicalImage = await buildImageRecord({
    token: input.token,
    userId: input.userId,
    companionId: input.companion.id,
    visualProfileId: input.visualProfile.id,
    promptHash: sha(`${input.visualProfile.prompt_hash}:canonical:${canonicalPrompt}`),
    capture: canonicalCapture,
    generated: canonicalGenerated,
    identityPack: input.visualProfile.identity_pack,
    promptText: canonicalPrompt,
    promptVersion: PROMPT_VERSION.canonical,
    surfaceType: 'canonical',
    scope,
  });
  logImageMachine(scope, 'persistence_success', { canonicalImageId: canonicalImage.id });

  try {
    const galleryImages = await generateGalleryFromCanonical({
      token: input.token,
      userId: input.userId,
      companion: input.companion,
      visualProfile: input.visualProfile,
      canonicalImage,
      scope,
    });
    logImageMachine(scope, 'final_outcome', { status: 'ready', canonicalImageId: canonicalImage.id, galleryCount: galleryImages.length });
    return { kind: 'setup_pack', status: 'ready', canonicalImage, galleryImages };
  } catch (error) {
    logImageMachine(scope, 'final_outcome', { status: 'partial_success', reason: error instanceof Error ? error.message : 'gallery_generation_failed' });
    throw new VirtualGirlfriendImagePackError('Gallery generation from canonical reference failed.', canonicalImage.id, { cause: error });
  }
};

const runRegenerateImageMachine = async (input: VirtualGirlfriendRegenerateMachineRequest): Promise<VirtualGirlfriendRegenerateMachineResult> => {
  const scope = 'regenerate';
  logImageMachine(scope, 'request_start', { visualProfileId: input.visualProfile.id, regenerateGallery: input.regenerateGallery });
  const companion = await getVirtualGirlfriendCompanionById(input.token, input.visualProfile.user_id, input.visualProfile.companion_id);
  if (!companion) throw new VirtualGirlfriendCanonicalRegenerateError('Companion was not found for canonical regeneration.');

  const captures = buildCapturePlan(companion);
  const canonicalCapture = captures.find((capture) => capture.kind === 'canonical');
  if (!canonicalCapture) throw new VirtualGirlfriendCanonicalRegenerateError('Canonical capture plan is missing.');

  const fallbackRegeneratePrompt = buildRegeneratePrompt({
    sex: companion.structured_profile?.sex ?? 'female',
    age: Number(companion.structured_profile?.age) || 26,
    origin: companion.structured_profile?.origin ?? 'white',
    hairColor: companion.structured_profile?.hairColor ?? 'dark brown',
    hairLength: 'medium',
    eyeColor: 'brown',
    bodyType:
      companion.structured_profile?.bodyType
      ?? companion.structured_profile?.figure
      ?? 'slim',
    identityAnchors: input.visualProfile.identity_pack.continuityAnchors,
    seedPromptHint: companion.structured_profile?.selectedPortraitPrompt ?? undefined,
  });
  const canonicalPrompt = input.visualProfile.seed_prompt?.trim()
    ? input.visualProfile.seed_prompt.trim()
    : fallbackRegeneratePrompt;
  const seedPortraitDataUrl = typeof input.visualProfile.source_setup?.selectedPortraitImage === 'string'
    ? input.visualProfile.source_setup.selectedPortraitImage
    : null;

  if (seedPortraitDataUrl && !parseDataUrlImage(seedPortraitDataUrl)) {
    throw new VirtualGirlfriendCanonicalRegenerateError('Selected portrait reference is invalid data URL.', null, {
      cause: new VirtualGirlfriendImageMachineError('Selected portrait data URL cannot be decoded.', 'invalid_reference', 'prerequisites'),
    });
  }

  const seedPortrait = seedPortraitDataUrl ? parseDataUrlImage(seedPortraitDataUrl) : null;

  const canonicalGenerated = await runProviderGeneration({
    scope,
    mode: seedPortrait ? 'canonical_from_reference' : 'canonical',
    prompt: canonicalPrompt,
    referenceImageBytes: seedPortrait?.bytes,
    referenceMimeType: seedPortrait?.mimeType,
    imageWeight: 90,
  });

  const canonicalImage = await buildImageRecord({
    token: input.token,
    userId: input.visualProfile.user_id,
    companionId: companion.id,
    visualProfileId: input.visualProfile.id,
    promptHash: sha(`${input.visualProfile.prompt_hash}:regen:canonical:${canonicalPrompt}`),
    capture: canonicalCapture,
    generated: canonicalGenerated,
    identityPack: input.visualProfile.identity_pack,
    promptText: canonicalPrompt,
    promptVersion: PROMPT_VERSION.regenerate,
    surfaceType: 'regenerate',
    scope,
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
        scope,
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
    seedPrompt: canonicalPrompt,
    promptVersion: PROMPT_VERSION.canonical,
    surfaceType: 'canonical',
  });

  const status = galleryImages.length > 0 || !input.regenerateGallery ? 'ready' : 'partial_success';
  logImageMachine(scope, 'final_outcome', { status, canonicalImageId: canonicalImage.id, galleryCount: galleryImages.length });
  return {
    kind: 'regenerate',
    status,
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
  const scope = 'chat_image';
  logImageMachine(scope, 'request_start', { companionId: input.companion.id, category: input.category, allowFreshGeneration: input.allowFreshGeneration });

  const reusableSelection = pickReusableImage(input.category, input.existingImages);
  const reusable = reusableSelection.image;
  if (!reusableSelection.image && reusableSelection.reason) {
    logImageMachine(scope, 'reuse_unavailable', { reason: reusableSelection.reason, category: input.category });
  }
  if (reusable) {
    logImageMachine(scope, 'reused_existing_image', { imageId: reusable.id, category: input.category });
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
      reason: undefined,
    };
  }

  if (!input.allowFreshGeneration || !input.visualProfile) {
    const reason = !input.allowFreshGeneration ? 'missing_prerequisites:fresh_generation_not_allowed' : 'missing_prerequisites:visual_profile_missing';
    logImageMachine(scope, 'final_outcome', { status: 'skipped_prerequisites', reason });
    return {
      kind: 'chat_image',
      status: 'skipped_prerequisites',
      outcome: 'skipped_prerequisites',
      attachment: null,
      reason,
    };
  }

  let canonical: VirtualGirlfriendCompanionImageRecord;
  try {
    canonical = resolveCanonicalReference(input.visualProfile, input.existingImages);
    logImageMachine(scope, 'reference_resolved', { canonicalImageId: canonical.id });
  } catch (error) {
    const reason = error instanceof VirtualGirlfriendImageMachineError ? `${error.reason}:${error.message}` : 'missing_prerequisites:canonical_reference_missing';
    logImageMachine(scope, 'final_outcome', { status: 'skipped_prerequisites', reason });
    return {
      kind: 'chat_image',
      status: 'skipped_prerequisites',
      outcome: 'skipped_prerequisites',
      attachment: null,
      reason,
    };
  }

  try {
    const reference = await downloadReferenceBytes({
      scope,
      deliveryUrl: canonical.delivery_url,
      fallbackMimeType: canonical.origin_mime_type,
    });
    logImageMachine(scope, 'download_success', { canonicalImageId: canonical.id, bytes: reference.bytes.byteLength });

    const prompt = buildChatPrompt({ companion: input.companion, visualProfile: input.visualProfile, category: input.category });
    const generated = await runProviderGeneration({
      scope,
      mode: 'chat_from_reference',
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
      promptText: prompt,
      promptVersion: PROMPT_VERSION.chat,
      surfaceType: 'chat',
      scope,
    });
    logImageMachine(scope, 'final_outcome', { status: 'ready', imageId: chatImage.id });

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
    const reason = error instanceof VirtualGirlfriendImageMachineError
      ? `${error.reason}:${error.message}`
      : error instanceof Error
        ? `provider_error:${error.message}`
        : 'provider_error:chat_generation_failed';
    logImageMachine(scope, 'final_outcome', { status: 'failed', reason });
    return {
      kind: 'chat_image',
      status: 'failed',
      outcome: 'failed_generation',
      attachment: null,
      reason,
    };
  }
};

export const runPortraitPreviewImageMachine = async (
  input: VirtualGirlfriendPortraitPreviewRequest,
): Promise<VirtualGirlfriendPortraitPreviewResult> => {
  const count = Math.min(Math.max(input.count ?? 4, 1), 8);
  const leaderPrompt = buildPreviewPrompt(input, 0);
  const leaderSeed = Math.floor(Math.random() * 2147483647);

  let leaderGenerated: IdeogramGeneratedImage;
  try {
    leaderGenerated = await withRetries({
      attempts: MACHINE_RETRY_ATTEMPTS.providerRequest,
      scope: 'portrait_preview',
      stage: 'provider_request',
      reason: 'provider_error',
      run: () =>
        withTimeout('provider_generation', MACHINE_TIMEOUT_MS.providerRequest, () =>
          generatePortraitPreviewImageWithIdeogram(leaderPrompt, leaderSeed),
        ),
    });
  } catch {
    const candidates = await fallbackParallelGeneration(input, count);
    return { kind: 'portrait_preview', status: 'ready', candidates };
  }

  const leaderCandidate = {
    id: 'candidate-1',
    label: 'Candidate 1',
    prompt: leaderPrompt,
    promptVersion: PROMPT_VERSION.preview,
    imageDataUrl: toDataUrl(leaderGenerated.bytes, leaderGenerated.mimeType),
  } satisfies VirtualGirlfriendPortraitPreviewCandidate;

  const followerIndices = Array.from({ length: Math.max(count - 1, 0) }, (_, i) => i + 1);
  const followerResults = await Promise.allSettled(
    followerIndices.map(async (variantIndex) => {
      const prompt = buildPreviewPrompt(input, variantIndex);
      const seed = Math.floor(Math.random() * 2147483647);
      const generated = await withTimeout('provider_generation', MACHINE_TIMEOUT_MS.providerRequest, () =>
        generatePreviewWithCharacterReference(prompt, leaderGenerated.bytes, leaderGenerated.mimeType, seed),
      );
      return {
        id: `candidate-${variantIndex + 1}`,
        label: `Candidate ${variantIndex + 1}`,
        prompt,
        promptVersion: PROMPT_VERSION.preview,
        imageDataUrl: toDataUrl(generated.bytes, generated.mimeType),
      } satisfies VirtualGirlfriendPortraitPreviewCandidate;
    }),
  );

  const followerCandidates = followerResults
    .filter((result): result is PromiseFulfilledResult<VirtualGirlfriendPortraitPreviewCandidate> => result.status === 'fulfilled')
    .map((result) => result.value);

  return { kind: 'portrait_preview', status: 'ready', candidates: [leaderCandidate, ...followerCandidates] };
};

const fallbackParallelGeneration = async (
  input: VirtualGirlfriendPortraitPreviewRequest,
  count: number,
): Promise<VirtualGirlfriendPortraitPreviewCandidate[]> => {
  const settled = await Promise.allSettled(
    Array.from({ length: count }).map(async (_, index) => {
      const prompt = buildPreviewPrompt(input, index);
      const seed = Math.floor(Math.random() * 2147483647);
      const generated = await withRetries({
        attempts: MACHINE_RETRY_ATTEMPTS.providerRequest,
        scope: 'portrait_preview',
        stage: 'provider_request',
        reason: 'provider_error',
        run: () =>
          withTimeout('provider_generation', MACHINE_TIMEOUT_MS.providerRequest, () =>
            generatePortraitPreviewImageWithIdeogram(prompt, seed),
          ),
      });
      return {
        id: `candidate-${index + 1}`,
        label: `Candidate ${index + 1}`,
        prompt,
        promptVersion: PROMPT_VERSION.preview,
        imageDataUrl: toDataUrl(generated.bytes, generated.mimeType),
      } satisfies VirtualGirlfriendPortraitPreviewCandidate;
    }),
  );

  const candidates = settled
    .filter((result): result is PromiseFulfilledResult<VirtualGirlfriendPortraitPreviewCandidate> => result.status === 'fulfilled')
    .map((result, successIndex) => ({
      ...result.value,
      id: `candidate-${successIndex + 1}`,
      label: `Candidate ${successIndex + 1}`,
    }));

  if (candidates.length < 2) {
    throw new Error('Not enough portrait preview candidates generated successfully');
  }

  return candidates;
};
