import crypto from 'node:crypto';
import {
  generateCanonicalImage,
  generatePortraitPreviewImage,
  generateGalleryImageFromReference,
  generateChatImageFromReference,
  generateChatImageFromReferenceFaceGen,
  generateChatImageFromReferenceFaceSwap,
  type GeneratedImage,
  type PortraitReferenceImage,
} from '@/lib/virtual-girlfriend/image-provider';
import type { KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';
import { isUsablePortraitImageBytes } from '@/lib/virtual-girlfriend/image-luminance';
import {
  PORTRAIT_PREVIEW_CANDIDATE_COUNT,
  resolveModelsLabPortraitModel,
} from '@/lib/virtual-girlfriend/modelslab-image-config';
import {
  buildCanonicalPrompt,
  canonicalPromptVersion,
  type CanonicalPromptInput,
} from '@/lib/virtual-girlfriend/prompt-builder/surfaces/canonical';
import {
  buildGalleryPrompt,
  galleryPromptVersion,
  type GalleryPromptInput,
} from '@/lib/virtual-girlfriend/prompt-builder/surfaces/gallery';
import {
  buildChatPrompt,
  chatPromptVersion,
  type ChatPromptInput,
} from '@/lib/virtual-girlfriend/prompt-builder/surfaces/chat';
import { buildRegeneratePrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/regenerate';
import { buildPreviewPrompt } from '@/lib/virtual-girlfriend/prompt-builder/surfaces/preview';
import { detectExplicitImageIntent, isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import {
  resolveChatFaceReference,
  resolveChatVisualContext,
} from '@/lib/virtual-girlfriend/chat-image-bootstrap';
import { wardrobeContextFromCompanion } from '@/lib/virtual-girlfriend/companion-wardrobe';
import { resolveChatGenerationRoute } from '@/lib/virtual-girlfriend/image-generation-router';
import { isNearCloneOfReference } from '@/lib/virtual-girlfriend/image-clone-detection';
import {
  isLikelyBodyCroppedAtBottom,
  isLikelyClothedExplicitFallback,
} from '@/lib/virtual-girlfriend/image-framing';
import { isHighExposureExplicit } from '@/lib/virtual-girlfriend/explicit-exposure';
import {
  isPoseHeavyExplicitLevel,
  resolvePhotoGenerationSpec,
} from '@/lib/virtual-girlfriend/photo-generation-spec';
import { buildRandomScene } from '@/lib/virtual-girlfriend/prompt-builder/utils/scene-randomizer';
import { PROMPT_VERSION } from '@/lib/virtual-girlfriend/prompt-builder/versions';
import {
  archiveBrowserImageToR2,
  publishBrowserImage,
} from '@/lib/storage/publish-browser-image';
import { VIRTUAL_GIRLFRIEND_GALLERY_TARGET } from '@/lib/virtual-girlfriend/gallery';
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
/** ai_companion_images.variant_index is postgres smallint (-32768..32767). */
const MAX_IMAGE_VARIANT_INDEX = 32_767;
const randomChatVariantIndex = () => Math.floor(Math.random() * MAX_IMAGE_VARIANT_INDEX);
const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const MACHINE_TIMEOUT_MS = {
  /** Portrait / canonical / gallery — typically finishes under 60s. */
  providerRequest: 60_000,
  /** Aurelium text2img on ModelsLab can poll 30–90s under load. */
  portraitPreviewRequest: 120_000,
  /** In-chat photos (Face Gen poll + SDXL fallback + delivery) — Vercel maxDuration 300. */
  chatProviderRequest: 270_000,
  /** Kontext dev explicit img2img before Face Gen fallback. */
  chatKontextAttempt: 90_000,
  /** SDXL/Aurelium img2img attempt before Face Gen fallback. */
  chatSdxlAttempt: 90_000,
  /** Single Face Gen attempt — queue often exceeds 90s; keep within 270s total budget. */
  chatFaceGenAttempt: 95_000,
  /** Body text2img + single-face-swap — primary path for all explicit chat. */
  chatFaceSwapAttempt: 180_000,
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
  userMessage?: string;
  visualSceneHint?: string;
  preferFreshGeneration?: boolean;
};

export type VirtualGirlfriendPortraitPreviewRequest = {
  kind: 'portrait_preview';
  count?: number;
  userId?: string;
  skinTone?: string;
  breastSize?: string;
  styleVibe?: string;
  personality?: string;
  occupation?: string;
  freeformDetails?: string;
} & PreviewTraits;

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

// Matches VIRTUAL_GIRLFRIEND_GALLERY_TARGET while credit cap is in effect.
const SETUP_GALLERY_BATCH = 2;
const GALLERY_TOPUP_BATCH = 2;

type GalleryScenePreset = {
  framing: string;
  environment: string;
  environmentGlam: string;
  mood: string;
  wardrobe: string;
  wardrobeGlam: string;
  expression: string;
  glamourLevel: string;
};

// Diverse scene pool so a companion's gallery reads like a real photo set.
const GALLERY_SCENE_PRESETS: GalleryScenePreset[] = [
  { framing: 'waist-up candid framing', environment: 'sunlit café by a window', environmentGlam: 'chic rooftop lounge at golden hour', mood: 'playful relaxed charm', wardrobe: 'fashion-forward flattering daywear — fitted top or cute dress', wardrobeGlam: 'elegant silk slip dress', expression: 'candid mid-conversation warmth', glamourLevel: 'balanced premium casual' },
  { framing: 'half-body environmental composition', environment: 'cozy golden-hour city street', environmentGlam: 'night-out premium venue with warm bokeh', mood: 'flirty confident energy', wardrobe: 'trendy smart-casual outfit, flattering fit', wardrobeGlam: 'glamorous statement evening dress', expression: 'confident direct gaze with subtle smile', glamourLevel: 'refined lifestyle polish' },
  { framing: 'three-quarter body, leaning casually', environment: 'modern apartment with soft daylight', environmentGlam: 'luxury hotel suite with mood lighting', mood: 'warm inviting calm', wardrobe: 'soft oversized knit with fitted bottoms', wardrobeGlam: 'satin lounge set, elegant and tasteful', expression: 'soft genuine smile', glamourLevel: 'natural cozy polish' },
  { framing: 'waist-up, outdoors', environment: 'lush green park in dappled sunlight', environmentGlam: 'beach boardwalk at sunset', mood: 'bright breezy joy', wardrobe: 'summery flattering dress', wardrobeGlam: 'chic resort outfit', expression: 'natural candid laugh', glamourLevel: 'fresh lifestyle' },
  { framing: 'half-body, seated', environment: 'stylish bar with warm ambient light', environmentGlam: 'upscale cocktail bar with neon accents', mood: 'magnetic flirtatious', wardrobe: 'sleek going-out top, flattering', wardrobeGlam: 'bold statement going-out dress', expression: 'playful over-the-shoulder glance', glamourLevel: 'elevated evening' },
  { framing: 'upper body, indoor', environment: 'bright bedroom with soft morning light', environmentGlam: 'plush bedroom with warm glow', mood: 'intimate tender', wardrobe: 'cozy fitted casual set', wardrobeGlam: 'elegant silk camisole, tasteful', expression: 'soft inviting look', glamourLevel: 'soft intimate polish' },
  { framing: 'three-quarter, standing', environment: 'urban rooftop with skyline behind', environmentGlam: 'penthouse balcony at dusk', mood: 'confident poised', wardrobe: 'tailored chic outfit', wardrobeGlam: 'sophisticated evening ensemble', expression: 'composed confident gaze', glamourLevel: 'premium polished' },
  { framing: 'waist-up candid', environment: 'art gallery interior', environmentGlam: 'elegant gala event lighting', mood: 'cultured charming', wardrobe: 'smart stylish daywear', wardrobeGlam: 'refined cocktail dress', expression: 'engaged warm smile', glamourLevel: 'sophisticated' },
];

const isGlamAesthetic = (companion: VirtualGirlfriendCompanionRecord) => {
  const aesthetic = companion.visual_aesthetic?.toLowerCase() ?? '';
  return aesthetic.includes('night') || aesthetic.includes('luxury') || aesthetic.includes('glam');
};

const buildCanonicalCapture = (companion: VirtualGirlfriendCompanionRecord): CapturePlan => {
  const glam = isGlamAesthetic(companion);
  return {
    kind: 'canonical',
    variantIndex: 0,
    label: 'canonical portrait',
    framing: 'close-up portrait, eye-level, natural perspective',
    environment: glam ? 'elevated interior with soft practical lights' : 'bright natural indoor setting',
    mood: 'warm magnetic confidence',
    wardrobe: glam ? 'elegant figure-flattering fitted dress, premium fabric' : 'effortlessly chic fitted top, stylish and flattering',
    expression: 'inviting slight smile, emotionally present',
    glamourLevel: glam ? 'high but tasteful' : 'moderate natural polish',
  };
};

// Gallery captures come from the preset pool, indexed by 1-based gallery
// position so setup and later top-up batches stay distinct and diverse.
const buildGalleryCaptureForIndex = (companion: VirtualGirlfriendCompanionRecord, galleryIndex: number): CapturePlan => {
  const glam = isGlamAesthetic(companion);
  const preset = GALLERY_SCENE_PRESETS[(galleryIndex - 1) % GALLERY_SCENE_PRESETS.length];
  return {
    kind: 'gallery',
    variantIndex: galleryIndex,
    label: `gallery moment ${galleryIndex}`,
    framing: preset.framing,
    environment: glam ? preset.environmentGlam : preset.environment,
    mood: preset.mood,
    wardrobe: glam ? preset.wardrobeGlam : preset.wardrobe,
    expression: preset.expression,
    glamourLevel: preset.glamourLevel,
  };
};

const buildGalleryCaptures = (
  companion: VirtualGirlfriendCompanionRecord,
  fromIndex: number,
  count: number,
): CapturePlan[] =>
  Array.from({ length: Math.max(0, count) }, (_, i) => buildGalleryCaptureForIndex(companion, fromIndex + i));

const buildCapturePlan = (companion: VirtualGirlfriendCompanionRecord): CapturePlan[] => [
  buildCanonicalCapture(companion),
  ...buildGalleryCaptures(companion, 1, SETUP_GALLERY_BATCH),
];

const toCanonicalPromptInput = (
  companion: VirtualGirlfriendCompanionRecord,
  identityPack?: VirtualGirlfriendVisualIdentityPack,
): CanonicalPromptInput => {
  const sp = companion.structured_profile;
  const age = Number(sp?.age);
  const identityInvariants = identityPack
    ? Object.values(identityPack.identityInvariants ?? {}).filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    )
    : undefined;

  return {
    sex: sp?.sex ?? 'female',
    age: Number.isFinite(age) && age > 0 ? age : 26,
    origin: sp?.origin ?? 'mixed',
    hairColor: sp?.hairColor ?? 'dark brown',
    hairLength: sp?.hairLength ?? 'long',
    eyeColor: sp?.eyeColor ?? 'brown',
    bodyType: sp?.bodyType ?? sp?.figure ?? 'slim',
    skinTone: sp?.skinTone ?? undefined,
    breastSize: sp?.breastSize ?? undefined,
    occupation: sp?.occupation ?? undefined,
    identityAnchors: identityPack?.continuityAnchors ?? undefined,
    identityInvariants,
    coreLook: identityPack?.coreLookDescriptors,
    wardrobeDirection: identityPack?.wardrobeDirection,
    lightingMood: identityPack?.lightingMoodDirection,
    cameraPreferences: identityPack?.cameraCompositionPreferences,
    realismLevel: identityPack?.realismPolishLevel,
    negativeConstraints: identityPack?.negativeConstraints,
  };
};

const toGalleryPromptInput = (
  companion: VirtualGirlfriendCompanionRecord,
  identityPack: VirtualGirlfriendVisualIdentityPack,
  capture: CapturePlan,
): GalleryPromptInput => {
  const canonicalInput = toCanonicalPromptInput(companion, identityPack);
  return {
    ...canonicalInput,
    identityAnchors: identityPack.continuityAnchors,
    sceneHint: `${capture.environment}; framing ${capture.framing}; wardrobe ${capture.wardrobe}; expression ${capture.expression}; mood ${capture.mood}`,
  };
};

const toChatPromptInput = (
  companion: VirtualGirlfriendCompanionRecord,
  identityPack: VirtualGirlfriendVisualIdentityPack,
  chatCategory?: string,
  userMessage?: string,
  visualSceneHint?: string,
): ChatPromptInput => {
  const canonicalInput = toCanonicalPromptInput(companion, identityPack);
  const wardrobeContext = wardrobeContextFromCompanion(companion);
  const hasUserMessage = Boolean(userMessage?.trim());
  const photoSpec = hasUserMessage
    ? resolvePhotoGenerationSpec(userMessage!, wardrobeContext)
    : null;

  const explicitIntent = photoSpec?.explicit
    ?? (userMessage ? detectExplicitImageIntent(userMessage) : false)
    ?? (visualSceneHint ? detectExplicitImageIntent(visualSceneHint) : false);

  const sceneDirective = photoSpec?.sceneDirective
    ?? visualSceneHint?.trim()
    ?? (explicitIntent ? userMessage?.trim() : undefined);

  const contextHint = sceneDirective
    ? explicitIntent
      ? `${sceneDirective} Ignore all clothing in the reference image.`
      : `Restyle this exact person for a brand new shot: ${sceneDirective}. Change wardrobe, pose, and setting to match that request even if the reference photo shows different clothing or location. Keep the same face and identity lock.`
    : `${buildRandomScene(wardrobeContext)}. Same person, same face, preserve identity lock.`;

  return {
    ...canonicalInput,
    wardrobeDirection: sceneDirective ? undefined : canonicalInput.wardrobeDirection,
    identityAnchors: identityPack.continuityAnchors,
    category: photoSpec?.imageCategory ?? (chatCategory || undefined),
    contextHint,
    explicitIntent,
    explicitExposureLevel: photoSpec?.exposureLevel ?? undefined,
    requestedLook: Boolean(sceneDirective),
  };
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

/** Portrait picks may be embedded data URLs or hosted preview URLs from ModelsLab/Cloudinary. */
/** Persist the user-selected Aurelium portrait as canonical — no Kontext/img2img drift. */
const resolveCanonicalFromSelectedPortrait = async (
  scope: string,
  reference: PortraitReferenceImage,
): Promise<GeneratedImage> => {
  const portraitModel = resolveModelsLabPortraitModel();
  let bytes: Buffer;
  let mimeType: string;

  if ('bytes' in reference && reference.bytes.byteLength) {
    bytes = reference.bytes;
    mimeType = reference.mimeType;
  } else if ('url' in reference) {
    const downloaded = await downloadReferenceBytes({
      scope,
      deliveryUrl: reference.url,
      fallbackMimeType: 'image/png',
    });
    bytes = downloaded.bytes;
    mimeType = downloaded.mimeType;
  } else {
    throw new VirtualGirlfriendImageMachineError('Selected portrait reference is invalid.', 'invalid_reference', 'prerequisites');
  }

  if (!isUsablePortraitImageBytes(bytes)) {
    throw new VirtualGirlfriendImageMachineError(
      'Selected portrait is blank or unusable.',
      'invalid_reference',
      'prerequisites',
    );
  }

  logImageMachine(scope, 'canonical_direct_persist', { bytes: bytes.byteLength, model: portraitModel });

  return {
    bytes,
    mimeType,
    width: null,
    height: null,
    revisedPrompt: null,
    provider: 'modelslab',
    model: portraitModel,
    endpoint: '/canonical/direct_persist',
    requestId: null,
    jobId: null,
  };
};

const parsePortraitReference = (value: string): PortraitReferenceImage | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const embedded = parseDataUrlImage(trimmed);
  if (embedded) {
    return { bytes: embedded.bytes, mimeType: embedded.mimeType };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed };
  }

  return null;
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
  mode: 'canonical' | 'gallery_from_reference' | 'chat_from_reference';
  prompt: string;
  reference?: PortraitReferenceImage;
  imageWeight?: number;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
  explicitHighExposure?: boolean;
}) => {
  logImageMachine(input.scope, 'provider_call_start', { mode: input.mode });
  const run = async () => {
    if (input.mode === 'canonical') {
      return withTimeout('provider_generation', MACHINE_TIMEOUT_MS.providerRequest, () => generateCanonicalImage(input.prompt));
    }

    if (!input.reference) {
      throw new VirtualGirlfriendImageMachineError('Reference image missing for provider reference generation.', 'invalid_reference', 'prerequisites');
    }

    if (!('bytes' in input.reference)) {
      throw new VirtualGirlfriendImageMachineError('Reference bytes missing for gallery/chat generation.', 'invalid_reference', 'prerequisites');
    }

    const referenceImageBytes = input.reference.bytes;
    const referenceMimeType = input.reference.mimeType;

    const generateFromReference = input.mode === 'gallery_from_reference'
      ? generateGalleryImageFromReference
      : generateChatImageFromReference;

    const providerTimeoutMs =
      input.mode === 'chat_from_reference'
        ? MACHINE_TIMEOUT_MS.chatProviderRequest
        : MACHINE_TIMEOUT_MS.providerRequest;

    return withTimeout('provider_generation', providerTimeoutMs, () => generateFromReference({
      prompt: input.prompt,
      referenceImageBytes,
      referenceMimeType,
      ...(input.mode === 'chat_from_reference'
        ? {
            ...(input.kontextOptions ? { kontextOptions: input.kontextOptions } : {}),
            ...(input.preferDevModel ? { preferDevModel: input.preferDevModel } : {}),
            ...(input.explicitHighExposure ? { explicitHighExposure: input.explicitHighExposure } : {}),
          }
        : {}),
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
  generated: GeneratedImage;
  identityPack: VirtualGirlfriendVisualIdentityPack;
  referenceImageId?: string;
  lineageExtra?: Record<string, unknown>;
  promptText: string;
  promptVersion: string;
  surfaceType: string;
  scope: string;
}) => {
  const key = `virtual-girlfriend-images/${input.userId}/${input.companionId}/${STYLE_VERSION}/${input.capture.kind}-${input.capture.variantIndex}-${Date.now()}.png`;

  logImageMachine(input.scope, 'upload_start', { target: 'r2_archive_optional', key });
  const r2Archive = await archiveBrowserImageToR2({
    storageKey: key,
    bytes: input.generated.bytes,
    mimeType: input.generated.mimeType,
  });
  if (r2Archive) {
    logImageMachine(input.scope, 'upload_success', { target: 'r2_archive', key: r2Archive.key });
  }

  logImageMachine(input.scope, 'upload_start', { target: 'browser_delivery', key });
  const published = await withRetries({
    attempts: MACHINE_RETRY_ATTEMPTS.storageUpload,
    scope: input.scope,
    stage: 'storage_upload',
    reason: 'storage_error',
    run: () =>
      withTimeout('browser_delivery_upload', MACHINE_TIMEOUT_MS.storageUpload, async () => {
        const delivery = await publishBrowserImage({
          bytes: input.generated.bytes,
          mimeType: input.generated.mimeType,
          storageKey: key,
          cloudinaryFolderPath: `${input.userId}/${input.companionId}`,
          cloudinaryPublicId: `${STYLE_VERSION}-${input.capture.kind}-${input.capture.variantIndex}-${Date.now()}`,
        });
        if (!delivery?.deliveryUrl?.trim()) {
          throw new Error(
            'No public image delivery configured. Set R2_PUBLIC_BASE_URL (pub-*.r2.dev) or CLOUDINARY_* env vars.',
          );
        }
        return delivery;
      }),
  });

  const deliveryProvider = published.provider;
  const deliveryPublicId = published.publicId;
  const deliveryUrl = published.deliveryUrl;
  const deliveryWidth = published.width ?? input.generated.width;
  const deliveryHeight = published.height ?? input.generated.height;
  logImageMachine(input.scope, 'upload_success', {
    target: deliveryProvider,
    publicId: deliveryPublicId,
    archivedToR2: Boolean(r2Archive),
  });

  const [inserted] = await insertCompanionImages(input.token, [{
    user_id: input.userId,
    companion_id: input.companionId,
    visual_profile_id: input.visualProfileId,
    image_kind: input.capture.kind,
    variant_index: input.capture.variantIndex,
    origin_storage_provider: r2Archive?.provider ?? deliveryProvider,
    origin_storage_key: r2Archive?.key ?? deliveryPublicId,
    origin_mime_type: input.generated.mimeType,
    origin_byte_size: input.generated.bytes.byteLength,
    delivery_provider: deliveryProvider,
    delivery_public_id: deliveryPublicId,
    delivery_url: deliveryUrl,
    width: deliveryWidth ?? input.generated.width,
    height: deliveryHeight ?? input.generated.height,
    prompt_hash: input.promptHash,
    style_version: STYLE_VERSION,
    seed_metadata: {},
    lineage_metadata: {
      generation_mode: input.capture.kind === 'canonical' ? 'canonical' : 'gallery_from_canonical',
      reference_image_id: input.referenceImageId ?? null,
      provider: input.generated.provider,
      provider_model: input.generated.model,
      provider_request_id: input.generated.requestId,
      provider_job_id: input.generated.jobId,
      revisedPrompt: input.generated.revisedPrompt,
      ...input.lineageExtra,
    },
    moderation_status: 'pending',
    moderation: { provider: `${input.generated.provider}:${input.generated.model}` },
    provenance: {
      generatedBy: `${input.generated.provider}:${input.generated.model}`,
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

const pickReusableImage = (
  category: VirtualGirlfriendImageCategory,
  images: VirtualGirlfriendCompanionImageRecord[],
  options: { allowCanonicalReuse?: boolean } = {},
) => {
  const allowCanonicalReuse = options.allowCanonicalReuse ?? true;
  const eligible = images.filter((image) => image.delivery_url && (image.image_kind === 'gallery' || image.image_kind === 'canonical'));
  if (!eligible.length) {
    return { image: null, reason: 'no_reusable_image' as const };
  }

  // Prefer varied gallery shots over always returning the canonical portrait,
  // and pick randomly so repeated selfie requests don't return the same photo.
  const gallery = eligible.filter((image) => image.image_kind === 'gallery');
  const pool = gallery.length > 0 ? gallery : allowCanonicalReuse ? eligible : [];
  if (!pool.length) {
    return { image: null, reason: 'no_reusable_image' as const };
  }
  const categoryMatches = pool.filter((image) => image.lineage_metadata?.chatCategory === category);
  const choices = categoryMatches.length > 0 ? categoryMatches : pool;
  const image = choices[Math.floor(Math.random() * choices.length)] ?? null;

  return { image, reason: null };
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
  captures: CapturePlan[];
  scope: string;
}) => {
  const captures = input.captures;

  let canonicalRef: { bytes: Buffer; mimeType: string };
  try {
    canonicalRef = await downloadReferenceBytes({
      scope: input.scope,
      deliveryUrl: input.canonicalImage.delivery_url,
      fallbackMimeType: input.canonicalImage.origin_mime_type,
    });
  } catch (error) {
    logImageMachine(input.scope, 'gallery_reference_unavailable', {
      reason: error instanceof Error ? error.message : 'reference_download_failed',
    });
    return [];
  }

  // Generate gallery variants sequentially and resiliently: a single variant
  // failure (e.g. a transient provider/rate-limit error) must not discard the
  // others. Sequential avoids tripping provider concurrency limits.
  const galleryImages: VirtualGirlfriendCompanionImageRecord[] = [];
  for (const capture of captures) {
    try {
      const galleryPromptInput = toGalleryPromptInput(input.companion, input.visualProfile.identity_pack, capture);
      const prompt = buildGalleryPrompt(galleryPromptInput, capture.variantIndex);
      const generated = await runProviderGeneration({
        scope: input.scope,
        mode: 'gallery_from_reference',
        prompt,
        reference: { bytes: canonicalRef.bytes, mimeType: canonicalRef.mimeType },
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
        promptVersion: galleryPromptVersion,
        surfaceType: 'gallery',
        scope: input.scope,
      });

      galleryImages.push(galleryImage);
    } catch (error) {
      logImageMachine(input.scope, 'gallery_variant_failed', {
        variantIndex: capture.variantIndex,
        reason: error instanceof Error ? error.message : 'gallery_variant_failed',
      });
    }
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

  const canonicalPromptInput = toCanonicalPromptInput(input.companion, input.visualProfile.identity_pack);
  const canonicalPrompt = buildCanonicalPrompt(canonicalPromptInput);
  const seedPortraitValue = typeof input.visualProfile.source_setup?.selectedPortraitImage === 'string'
    ? input.visualProfile.source_setup.selectedPortraitImage
    : null;
  const seedPortrait = seedPortraitValue ? parsePortraitReference(seedPortraitValue) : null;

  if (seedPortraitValue && !seedPortrait) {
    throw new VirtualGirlfriendImagePackError('Selected portrait reference is invalid.', null, {
      cause: new VirtualGirlfriendImageMachineError('Selected portrait reference cannot be resolved.', 'invalid_reference', 'prerequisites'),
    });
  }

  logImageMachine(scope, 'reference_resolved', {
    hasSeedPortrait: Boolean(seedPortrait),
    seedReferenceKind: seedPortrait && 'url' in seedPortrait ? 'url' : seedPortrait ? 'bytes' : 'none',
  });

  const canonicalGenerated = seedPortrait
    ? await resolveCanonicalFromSelectedPortrait(scope, seedPortrait)
    : await runProviderGeneration({
        scope,
        mode: 'canonical',
        prompt: canonicalPrompt,
      });
  logImageMachine(scope, 'provider_call_success', { stage: 'canonical', directPersist: Boolean(seedPortrait) });

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
    promptVersion: canonicalPromptVersion,
    surfaceType: 'canonical',
    scope,
  });
  logImageMachine(scope, 'persistence_success', { canonicalImageId: canonicalImage.id });

  const galleryImages = await generateGalleryFromCanonical({
    token: input.token,
    userId: input.userId,
    companion: input.companion,
    visualProfile: input.visualProfile,
    canonicalImage,
    captures: buildGalleryCaptures(input.companion, 1, SETUP_GALLERY_BATCH),
    scope,
  });
  const status = galleryImages.length > 0 ? 'ready' : 'partial_success';
  logImageMachine(scope, 'final_outcome', { status, canonicalImageId: canonicalImage.id, galleryCount: galleryImages.length });
  return { kind: 'setup_pack', status, canonicalImage, galleryImages };
};

export type VirtualGirlfriendGalleryTopUpResult = {
  kind: 'gallery_topup';
  galleryCount: number;
  generatedCount: number;
  reachedTarget: boolean;
  generated: VirtualGirlfriendCompanionImageRecord[];
};

/**
 * Generate the next batch of gallery photos toward the target, using the locked
 * canonical as the identity reference. Designed to be called repeatedly (one
 * batch per invocation) so the full grid fills in across requests without any
 * single request exceeding the serverless function limit.
 */
export const runGalleryTopUpImageMachine = async (input: {
  token: string;
  userId: string;
  companion: VirtualGirlfriendCompanionRecord;
  visualProfile: VirtualGirlfriendVisualProfileRecord;
  existingImages: VirtualGirlfriendCompanionImageRecord[];
  target?: number;
  batchSize?: number;
}): Promise<VirtualGirlfriendGalleryTopUpResult> => {
  const scope = 'gallery_topup';
  const target = input.target ?? VIRTUAL_GIRLFRIEND_GALLERY_TARGET;
  const batchSize = input.batchSize ?? GALLERY_TOPUP_BATCH;

  const existingGalleryCount = input.existingImages.filter((image) => image.image_kind === 'gallery').length;
  const remaining = Math.max(0, target - existingGalleryCount);
  if (remaining === 0) {
    return { kind: 'gallery_topup', galleryCount: existingGalleryCount, generatedCount: 0, reachedTarget: true, generated: [] };
  }

  const canonical = resolveCanonicalReference(input.visualProfile, input.existingImages);
  const count = Math.min(remaining, batchSize);
  const captures = buildGalleryCaptures(input.companion, existingGalleryCount + 1, count);

  logImageMachine(scope, 'request_start', { companionId: input.companion.id, existingGalleryCount, target, batch: count });

  const generated = await generateGalleryFromCanonical({
    token: input.token,
    userId: input.userId,
    companion: input.companion,
    visualProfile: input.visualProfile,
    canonicalImage: canonical,
    captures,
    scope,
  });

  const galleryCount = existingGalleryCount + generated.length;
  logImageMachine(scope, 'final_outcome', { galleryCount, generatedCount: generated.length, reachedTarget: galleryCount >= target });
  return {
    kind: 'gallery_topup',
    galleryCount,
    generatedCount: generated.length,
    reachedTarget: galleryCount >= target,
    generated,
  };
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
  const seedPortraitValue = typeof input.visualProfile.source_setup?.selectedPortraitImage === 'string'
    ? input.visualProfile.source_setup.selectedPortraitImage
    : null;
  const seedPortrait = seedPortraitValue ? parsePortraitReference(seedPortraitValue) : null;

  if (seedPortraitValue && !seedPortrait) {
    throw new VirtualGirlfriendCanonicalRegenerateError('Selected portrait reference is invalid.', null, {
      cause: new VirtualGirlfriendImageMachineError('Selected portrait reference cannot be resolved.', 'invalid_reference', 'prerequisites'),
    });
  }

  const canonicalGenerated = seedPortrait
    ? await resolveCanonicalFromSelectedPortrait(scope, seedPortrait)
    : await runProviderGeneration({
        scope,
        mode: 'canonical',
        prompt: canonicalPrompt,
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
        captures: buildGalleryCaptures(companion, 1, SETUP_GALLERY_BATCH),
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
  const explicitRequest = input.userMessage ? detectExplicitImageIntent(input.userMessage) : false;
  logImageMachine(scope, 'request_start', {
    companionId: input.companion.id,
    category: input.category,
    allowFreshGeneration: input.allowFreshGeneration,
    explicitRequest,
    preferFreshGeneration: input.preferFreshGeneration,
  });

  const isDirectUserPhotoRequest = Boolean(input.userMessage?.trim());

  // User-initiated photo requests must always generate a fresh image that matches
  // their directive — gallery reuse returned unrelated wardrobe/scenes.
  if (!isDirectUserPhotoRequest && !input.preferFreshGeneration && !explicitRequest) {
    const reusableSelection = pickReusableImage(input.category, input.existingImages, {
      allowCanonicalReuse: !explicitRequest,
    });
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
  }

  if (!input.allowFreshGeneration) {
    const reason = 'missing_prerequisites:fresh_generation_not_allowed';
    logImageMachine(scope, 'final_outcome', { status: 'skipped_prerequisites', reason });
    return {
      kind: 'chat_image',
      status: 'skipped_prerequisites',
      outcome: 'skipped_prerequisites',
      attachment: null,
      reason,
    };
  }

  const visualContext = resolveChatVisualContext({
    companion: input.companion,
    visualProfile: input.visualProfile,
    existingImages: input.existingImages,
  });
  if (!visualContext) {
    const reason = 'missing_prerequisites:visual_profile_missing';
    logImageMachine(scope, 'final_outcome', { status: 'skipped_prerequisites', reason });
    return {
      kind: 'chat_image',
      status: 'skipped_prerequisites',
      outcome: 'skipped_prerequisites',
      attachment: null,
      reason,
    };
  }

  const faceReference = resolveChatFaceReference({
    companion: input.companion,
    visualProfile: input.visualProfile,
    existingImages: input.existingImages,
  });
  if (!faceReference) {
    const reason = 'missing_prerequisites:canonical_reference_missing';
    logImageMachine(scope, 'final_outcome', { status: 'skipped_prerequisites', reason });
    return {
      kind: 'chat_image',
      status: 'skipped_prerequisites',
      outcome: 'skipped_prerequisites',
      attachment: null,
      reason,
    };
  }

  logImageMachine(scope, 'reference_resolved', {
    canonicalImageId: faceReference.imageId,
    referenceSource: faceReference.source,
    referenceDeliveryUrlHost: (() => {
      try {
        return new URL(faceReference.deliveryUrl).host;
      } catch {
        return 'invalid-url';
      }
    })(),
    profileCanonicalId: input.visualProfile?.canonical_reference_image_id ?? null,
    bootstrapped: visualContext.bootstrapped,
    visualProfileId: visualContext.visualProfileId,
  });

  try {
    const reference = await downloadReferenceBytes({
      scope,
      deliveryUrl: faceReference.deliveryUrl,
      fallbackMimeType: faceReference.originMimeType,
    });
    logImageMachine(scope, 'download_success', {
      canonicalImageId: faceReference.imageId,
      referenceSource: faceReference.source,
      bytes: reference.bytes.byteLength,
    });

    const chatPromptInput = toChatPromptInput(
      input.companion,
      visualContext.identityPack,
      input.category,
      input.userMessage,
      input.visualSceneHint,
    );
    const prompt = buildChatPrompt(chatPromptInput);
    const route = resolveChatGenerationRoute({
      explicit: chatPromptInput.explicitIntent ?? false,
      requestedLook: chatPromptInput.requestedLook ?? false,
      adultContentEnabled: isVirtualGirlfriendAdultContentEnabled(),
      highExposure: chatPromptInput.explicitExposureLevel
        ? isHighExposureExplicit(chatPromptInput.explicitExposureLevel)
        : false,
      preferFaceGen: resolveVgImageProvider() === 'modelslab',
      preferSdxl: resolveVgImageProvider() === 'modelslab',
    });
    logImageMachine(scope, 'generation_route', {
      provider: route.provider,
      modelKind: route.modelKind,
      guidanceScale: route.guidanceScale,
      explicit: chatPromptInput.explicitIntent,
      requestedLook: chatPromptInput.requestedLook,
    });

    const faceGenReference: PortraitReferenceImage =
      /^https?:\/\//i.test(faceReference.deliveryUrl.trim())
        ? { url: faceReference.deliveryUrl.trim() }
        : { bytes: reference.bytes, mimeType: reference.mimeType };

    const highExposure = chatPromptInput.explicitExposureLevel
      ? isHighExposureExplicit(chatPromptInput.explicitExposureLevel)
      : false;

    const exposureLevel = chatPromptInput.explicitExposureLevel ?? null;
    const poseHeavyExplicit = isPoseHeavyExplicitLevel(exposureLevel);

    const explicitUserPrompt =
      input.userMessage?.trim() && chatPromptInput.explicitIntent
        ? input.userMessage.trim()
        : prompt;

    const rejectPortraitClone = (generated: GeneratedImage, label: string) => {
      if (!chatPromptInput.explicitIntent) return;
      const refUrl = faceReference.deliveryUrl.trim();
      if (generated.temporaryUrl?.trim() === refUrl) {
        throw new VirtualGirlfriendImageMachineError(
          `${label} returned the reference image unchanged.`,
          'provider_error',
          'provider_request',
          true,
        );
      }
      if (generated.bytes.byteLength && isNearCloneOfReference(reference.bytes, generated.bytes)) {
        throw new VirtualGirlfriendImageMachineError(
          `${label} output too similar to clothed reference.`,
          'provider_error',
          'provider_request',
          true,
        );
      }
    };

    const needsFullBodyFraming =
      exposureLevel === 'full_nude' || exposureLevel === 'genital_focus';

    const rejectBodyCrop = (generated: GeneratedImage, label: string) => {
      if (!needsFullBodyFraming || !generated.bytes.byteLength) return;
      if (isLikelyBodyCroppedAtBottom(generated.bytes)) {
        throw new VirtualGirlfriendImageMachineError(
          `${label} output cropped before legs or feet.`,
          'provider_error',
          'provider_request',
          true,
        );
      }
    };

    const rejectClothedExplicitFallback = (generated: GeneratedImage, label: string) => {
      if (!poseHeavyExplicit || !generated.bytes.byteLength) return;
      if (isLikelyClothedExplicitFallback(generated.bytes, exposureLevel)) {
        throw new VirtualGirlfriendImageMachineError(
          `${label} kept clothed front pose instead of explicit rear/body request.`,
          'provider_error',
          'provider_request',
          true,
        );
      }
    };

    const generateFaceGenAttempt = (wideFraming: boolean | 'ultra' = false) => {
      if (!input.userMessage?.trim()) {
        throw new VirtualGirlfriendImageMachineError(
          'Face Gen explicit chat requires a user message.',
          'provider_error',
          'provider_request',
        );
      }
      return withTimeout('face_gen_generation', MACHINE_TIMEOUT_MS.chatFaceGenAttempt, () =>
        generateChatImageFromReferenceFaceGen({
          userMessage: input.userMessage!.trim(),
          reference: faceGenReference,
          wardrobeContext: wardrobeContextFromCompanion(input.companion),
          numInferenceSteps: 41,
          wideFraming,
        }),
      );
    };

    const generateFaceGenFallback = async () => {
      const result = await generateFaceGenAttempt(false);
      rejectBodyCrop(result, 'face_gen');
      return result;
    };

    const tryFaceSwapExplicit = () => {
      if (!input.userMessage?.trim()) {
        throw new VirtualGirlfriendImageMachineError(
          'Face swap explicit chat requires a user message.',
          'provider_error',
          'provider_request',
        );
      }
      return withTimeout('face_swap_generation', MACHINE_TIMEOUT_MS.chatFaceSwapAttempt, () =>
        generateChatImageFromReferenceFaceSwap({
          userMessage: input.userMessage!.trim(),
          reference: faceGenReference,
          wardrobeContext: wardrobeContextFromCompanion(input.companion),
        }),
      );
    };

    const generateExplicitWithFallback = async () => {
      const tryFaceGenPrimary = async () => {
        const result = await generateFaceGenFallback();
        rejectPortraitClone(result, 'face_gen');
        rejectBodyCrop(result, 'face_gen');
        return result;
      };

      try {
        const swapped = await tryFaceSwapExplicit();
        rejectPortraitClone(swapped, 'face_swap');
        rejectClothedExplicitFallback(swapped, 'face_swap');
        return swapped;
      } catch (swapError) {
        logImageMachine(scope, 'explicit_face_swap_fallback_face_gen', {
          reason: swapError instanceof Error ? swapError.message : 'face_swap_failed',
          timedOut: swapError instanceof Error && swapError.message.includes('timeout'),
          exposureLevel,
        });
        return tryFaceGenPrimary();
      }
    };

    if (route.modelKind === 'kontext_pro' && (chatPromptInput.explicitIntent || chatPromptInput.requestedLook)) {
      throw new VirtualGirlfriendImageMachineError(
        'Censored Kontext Pro must not handle explicit or sexual chat images.',
        'provider_error',
        'provider_request',
      );
    }

    const generated =
      chatPromptInput.explicitIntent
        ? await withTimeout('provider_generation', MACHINE_TIMEOUT_MS.chatProviderRequest, generateExplicitWithFallback)
        : route.provider === 'face_gen' && input.userMessage?.trim()
          ? await withTimeout('provider_generation', MACHINE_TIMEOUT_MS.chatProviderRequest, generateFaceGenFallback)
          : await withTimeout('provider_generation', MACHINE_TIMEOUT_MS.chatProviderRequest, () =>
              runProviderGeneration({
                scope,
                mode: 'chat_from_reference',
                prompt,
                reference: { bytes: reference.bytes, mimeType: reference.mimeType },
                kontextOptions: {
                  guidanceScale: route.guidanceScale,
                  numInferenceSteps: route.numInferenceSteps,
                  enableSafetyChecker: route.enableSafetyChecker,
                },
                preferDevModel:
                  route.modelKind === 'kontext_dev'
                  || Boolean(chatPromptInput.requestedLook),
              }),
            );

    const chatImage = await buildImageRecord({
      token: input.token,
      userId: input.userId,
      companionId: input.companion.id,
      visualProfileId: visualContext.visualProfileId,
      promptHash: sha(`${visualContext.promptHashSeed}:chat:${input.category}:${explicitUserPrompt}`),
      capture: {
        kind: 'gallery',
        variantIndex: randomChatVariantIndex(),
        label: `chat ${input.category}`,
        framing: 'chat-shot',
        environment: 'contextual',
        mood: 'warm',
        wardrobe: 'varied',
        expression: 'natural',
        glamourLevel: 'balanced',
      },
      generated,
      identityPack: visualContext.identityPack,
      referenceImageId: faceReference.imageId ?? undefined,
      lineageExtra: {
        generation_mode: 'chat_from_canonical',
        chatCategory: input.category,
        source: 'chat-image-machine',
      },
      promptText: chatPromptInput.explicitIntent ? explicitUserPrompt : prompt,
      promptVersion: chatPromptVersion,
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

const portraitPreviewDeliveryUrl = (generated: GeneratedImage) => {
  if (generated.bytes.byteLength > 0) {
    return toDataUrl(generated.bytes, generated.mimeType);
  }
  return generated.temporaryUrl?.trim() || '';
};

const derivePortraitPreviewSeed = (input: VirtualGirlfriendPortraitPreviewRequest, index: number) => {
  const fingerprint = JSON.stringify({
    userId: input.userId ?? 'anonymous',
    sex: input.sex,
    origin: input.origin,
    hairColor: input.hairColor,
    hairLength: input.hairLength,
    eyeColor: input.eyeColor,
    bodyType: input.bodyType,
    skinTone: input.skinTone,
    breastSize: input.breastSize,
    age: input.age,
    styleVibe: input.styleVibe,
    personality: input.personality,
    occupation: input.occupation,
    freeformDetails: input.freeformDetails,
    index,
  });
  const hash = crypto.createHash('sha256').update(fingerprint).digest();
  return hash.readUInt32BE(0) % 2_147_483_647;
};

export const runPortraitPreviewImageMachine = async (
  input: VirtualGirlfriendPortraitPreviewRequest,
): Promise<VirtualGirlfriendPortraitPreviewResult> => {
  const count = Math.min(Math.max(input.count ?? PORTRAIT_PREVIEW_CANDIDATE_COUNT, 2), 4);
  const candidates = await fallbackParallelGeneration(input, count);
  return { kind: 'portrait_preview', status: 'ready', candidates };
};

const generatePortraitPreviewCandidate = async (
  input: VirtualGirlfriendPortraitPreviewRequest,
  index: number,
  attemptOffset = 0,
): Promise<VirtualGirlfriendPortraitPreviewCandidate> => {
  const prompt = buildPreviewPrompt(input, index);
  const seed = (derivePortraitPreviewSeed(input, index) + attemptOffset) % 2_147_483_647;
  const generated = await withRetries({
    attempts: MACHINE_RETRY_ATTEMPTS.providerRequest,
    scope: 'portrait_preview',
    stage: 'provider_request',
    reason: 'provider_error',
    run: () =>
      withTimeout('provider_generation', MACHINE_TIMEOUT_MS.portraitPreviewRequest, () =>
        generatePortraitPreviewImage(prompt, seed)),
  });
  const imageDataUrl = portraitPreviewDeliveryUrl(generated);
  if (!imageDataUrl.trim()) {
    throw new Error('Portrait preview provider returned an empty image.');
  }

  return {
    id: `candidate-${index + 1}`,
    label: `Candidate ${index + 1}`,
    prompt,
    promptVersion: PROMPT_VERSION.preview,
    imageDataUrl,
  };
};

/** Serial generation — avoids parallel credit burn when ModelsLab is slow or failing. */
const PORTRAIT_PREVIEW_CONCURRENCY = 1;

const runPortraitPreviewTasksWithConcurrency = async (
  tasks: Array<() => Promise<VirtualGirlfriendPortraitPreviewCandidate>>,
  concurrency: number,
) => {
  const settled: PromiseSettledResult<VirtualGirlfriendPortraitPreviewCandidate>[] = [];
  let nextTaskIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (nextTaskIndex < tasks.length) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      try {
        settled[taskIndex] = { status: 'fulfilled', value: await tasks[taskIndex]() };
      } catch (reason) {
        settled[taskIndex] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(workers);
  return settled;
};

const summarizePortraitPreviewFailures = (
  settled: PromiseSettledResult<VirtualGirlfriendPortraitPreviewCandidate>[],
) =>
  settled
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));

const fallbackParallelGeneration = async (
  input: VirtualGirlfriendPortraitPreviewRequest,
  count: number,
): Promise<VirtualGirlfriendPortraitPreviewCandidate[]> => {
  const target = Math.min(Math.max(count, 2), 4);
  const maxAttempts = target;
  const tasks = Array.from({ length: maxAttempts }, (_, index) => () =>
    generatePortraitPreviewCandidate(input, index, Math.floor(index / target)));

  logImageMachine('portrait_preview', 'generation_start', {
    target,
    maxAttempts,
    concurrency: PORTRAIT_PREVIEW_CONCURRENCY,
    provider: resolveVgImageProvider(),
    portraitModel: resolveModelsLabPortraitModel(),
  });

  const settled = await runPortraitPreviewTasksWithConcurrency(tasks, PORTRAIT_PREVIEW_CONCURRENCY);

  const candidates = settled
    .filter((result): result is PromiseFulfilledResult<VirtualGirlfriendPortraitPreviewCandidate> => result.status === 'fulfilled')
    .map((result, successIndex) => ({
      ...result.value,
      id: `candidate-${successIndex + 1}`,
      label: `Candidate ${successIndex + 1}`,
    }));

  if (candidates.length < 1) {
    const failures = summarizePortraitPreviewFailures(settled);
    logImageMachine('portrait_preview', 'generation_failed', {
      attempts: maxAttempts,
      failures: failures.slice(0, 5),
    });
    const detail = failures[0] ?? 'unknown_error';
    throw new Error(`Not enough portrait preview candidates generated successfully (${detail})`);
  }

  logImageMachine('portrait_preview', 'generation_success', {
    requested: target,
    generated: candidates.length,
  });

  return candidates.slice(0, target);
};
