import { env } from '@/lib/env';
import { isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import { isUsablePortraitImageBytes } from '@/lib/virtual-girlfriend/image-luminance';
import { buildPreviewNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

export type { KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * Flux provider (fal.ai) — emergency fallback when VG_IMAGE_PROVIDER=flux.
 *
 * Phase 1 production uses ModelsLab (Aurelium portraits, direct-persist canonical,
 * Kontext Pro gallery). This module remains for dev/emergency override only.
 */

const FLUX_BASE_URL = env.FLUX_BASE_URL ?? 'https://fal.run';
/** Companion preview/canonical text2img — Pro reduces same-face collapse vs dev/LoRA portraits. */
const FLUX_COMPANION_MODEL =
  env.FLUX_COMPANION_MODEL?.trim() || env.FLUX_MODEL?.trim() || 'fal-ai/flux-pro/v1.1';
const FLUX_COMPANION_SAFETY_TOLERANCE = (() => {
  const parsed = Number(env.FLUX_COMPANION_SAFETY_TOLERANCE ?? '5');
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(6, Math.max(1, Math.floor(parsed)));
})();
const FLUX_KONTEXT_MODEL = env.FLUX_KONTEXT_MODEL ?? 'fal-ai/flux-pro/kontext';
// Adult chat images use the open-weights Kontext [dev] variant: it honors
// `enable_safety_checker: false` and has no separate hosted moderation gate, so
// explicit content renders instead of being blanked to a black image. SFW
// identity surfaces (preview/canonical/gallery) stay on the pro model above.
const FLUX_KONTEXT_DEV_MODEL = env.FLUX_KONTEXT_DEV_MODEL ?? 'fal-ai/flux-kontext/dev';

// fal exposes image_size as a named enum for the common ratios; map the
// aspect_ratio strings used in SURFACE_PARAMS onto those enums.
const IMAGE_SIZE_BY_ASPECT: Record<string, string> = {
  '1x1': 'square_hd',
  '3x4': 'portrait_4_3',
  '4x3': 'landscape_4_3',
  '9x16': 'portrait_16_9',
  '16x9': 'landscape_16_9',
};

// Kontext takes a colon-style aspect_ratio rather than an image_size enum.
const KONTEXT_ASPECT_BY_SURFACE: Record<string, string> = {
  '1x1': '1:1',
  '3x4': '3:4',
  '4x3': '4:3',
  '9x16': '9:16',
  '16x9': '16:9',
};

const resolveImageSize = (aspectRatio: string) => IMAGE_SIZE_BY_ASPECT[aspectRatio] ?? 'portrait_4_3';
const resolveKontextAspect = (aspectRatio: string) => KONTEXT_ASPECT_BY_SURFACE[aspectRatio] ?? '3:4';

const assertApiKey = () => {
  if (!env.FLUX_API_KEY) {
    throw new Error('FLUX_API_KEY is not configured.');
  }

  return env.FLUX_API_KEY;
};

const toDataUri = (bytes: Buffer, mimeType: string) => `data:${mimeType || 'image/png'};base64,${bytes.toString('base64')}`;

type FalImageResult = {
  images?: Array<{
    url?: string;
    width?: number;
    height?: number;
    content_type?: string;
  }>;
  has_nsfw_concepts?: boolean[];
  seed?: number;
  request_id?: string;
};

const callFal = async (model: string, body: Record<string, unknown>, errorLabel: string): Promise<Response> => {
  const response = await fetch(`${FLUX_BASE_URL}/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${assertApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${errorLabel} (${response.status}): ${await response.text()}`);
  }

  return response;
};

const extractGeneratedImage = async (
  response: Response,
  model: string,
  options?: { rejectBlankPortrait?: boolean },
): Promise<GeneratedImage> => {
  const payload = (await response.json()) as FalImageResult;
  const generated = payload.images?.[0];
  const temporaryUrl = generated?.url;
  if (!temporaryUrl) {
    throw new Error('Flux image generation returned no image URL.');
  }

  if (payload.has_nsfw_concepts?.[0]) {
    throw new Error('Flux image generation was moderated (has_nsfw_concepts=true).');
  }

  const imageResponse = await fetch(temporaryUrl);
  if (!imageResponse.ok) {
    throw new Error(`Flux temporary image download failed (${imageResponse.status}).`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  if (options?.rejectBlankPortrait && !isUsablePortraitImageBytes(bytes)) {
    throw new Error('Flux image generation returned a blank or near-black portrait.');
  }

  return {
    bytes,
    mimeType: generated.content_type ?? imageResponse.headers.get('content-type') ?? 'image/png',
    width: generated.width ?? null,
    height: generated.height ?? null,
    revisedPrompt: null,
    provider: 'flux',
    model,
    endpoint: `/${model}`,
    requestId: payload.request_id ?? null,
    jobId: payload.request_id ?? null,
  };
};

// Flux (flow-matching) has no separate negative-prompt channel on fal's
// flux/dev schema, so fold negative phrasing into the positive prompt instead.
const withNegatives = (prompt: string, negatives: string) =>
  negatives.trim() ? `${prompt}\nAvoid: ${negatives}` : prompt;

// The adult chat surface routes to the open-weights Kontext [dev] model with
// the safety checker off. On the hosted pro model, explicit content was blanked
// to a solid black image even with `enable_safety_checker: false`, because pro
// applies a second hosted `safety_tolerance` gate that defaults strict. The dev
// variant has no such gate, so disabling the checker is sufficient. SFW identity
// surfaces stay on the pro model with default safety.
const isAdultChatSurface = (surface: 'preview' | 'canonical' | 'gallery' | 'chat') =>
  surface === 'chat' && isVirtualGirlfriendAdultContentEnabled();

const kontextModelForSurface = (
  surface: 'preview' | 'canonical' | 'gallery' | 'chat',
  options?: { preferDevModel?: boolean; forceDevModel?: boolean },
) => {
  // Kontext Pro blanks explicit content — never use it for adult chat surfaces.
  if (
    surface === 'chat'
    && (options?.forceDevModel || isAdultChatSurface(surface) || options?.preferDevModel)
  ) {
    return FLUX_KONTEXT_DEV_MODEL;
  }
  return FLUX_KONTEXT_MODEL;
};

const falProviderOptions = (surface: 'preview' | 'canonical' | 'gallery' | 'chat') =>
  isAdultChatSurface(surface) ? { enable_safety_checker: false } : {};

const companionFluxProBody = (input: {
  prompt: string;
  aspectRatio: string;
  seed?: number;
}) => ({
  prompt: input.prompt,
  image_size: resolveImageSize(input.aspectRatio),
  num_images: 1,
  output_format: 'png',
  // Default safety_tolerance is 2 on Flux Pro and blanks adult-leaning portraits to black.
  safety_tolerance: FLUX_COMPANION_SAFETY_TOLERANCE,
  ...(input.seed !== undefined ? { seed: input.seed } : {}),
});

export const generateCanonicalImageWithFlux = async (prompt: string): Promise<GeneratedImage> => {
  const canonicalParams = SURFACE_PARAMS.canonical;
  const response = await callFal(
    FLUX_COMPANION_MODEL,
    companionFluxProBody({ prompt, aspectRatio: canonicalParams.aspect_ratio }),
    'Flux image generation failed',
  );

  return extractGeneratedImage(response, FLUX_COMPANION_MODEL, { rejectBlankPortrait: true });
};

export const generatePortraitPreviewImageWithFlux = async (
  prompt: string,
  seed?: number,
): Promise<GeneratedImage> => {
  const previewParams = SURFACE_PARAMS.preview;
  const response = await callFal(
    FLUX_COMPANION_MODEL,
    companionFluxProBody({ prompt, aspectRatio: previewParams.aspect_ratio, seed }),
    'Flux portrait preview generation failed',
  );

  return extractGeneratedImage(response, FLUX_COMPANION_MODEL, { rejectBlankPortrait: true });
};

const generateKontextFromReference = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  surface: 'preview' | 'canonical' | 'gallery' | 'chat';
  withPreviewNegatives?: boolean;
  seed?: number;
  errorLabel: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
}): Promise<GeneratedImage> => {
  const surfaceParams = SURFACE_PARAMS[input.surface];
  const model = kontextModelForSurface(input.surface, {
    preferDevModel: input.preferDevModel,
    forceDevModel: input.surface === 'chat' && input.kontextOptions?.enableSafetyChecker === false,
  });
  const prompt = input.withPreviewNegatives
    ? withNegatives(input.prompt, buildPreviewNegativePrompt())
    : input.prompt;

  const defaultSafety = falProviderOptions(input.surface).enable_safety_checker;
  const safetyChecker = input.kontextOptions?.enableSafetyChecker ?? defaultSafety ?? true;

  const response = await callFal(
    model,
    {
      prompt,
      image_url: toDataUri(input.referenceImageBytes, input.referenceMimeType),
      aspect_ratio: resolveKontextAspect(surfaceParams.aspect_ratio),
      num_images: surfaceParams.num_images,
      output_format: 'png',
      enable_safety_checker: safetyChecker,
      ...(input.kontextOptions?.guidanceScale !== undefined ? { guidance_scale: input.kontextOptions.guidanceScale } : {}),
      ...(input.kontextOptions?.numInferenceSteps !== undefined ? { num_inference_steps: input.kontextOptions.numInferenceSteps } : {}),
      ...(input.kontextOptions?.resolutionMode ? { resolution_mode: input.kontextOptions.resolutionMode } : {}),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    },
    input.errorLabel,
  );

  return extractGeneratedImage(response, model);
};

export const generateGalleryImageFromReferenceWithFlux = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    referenceImageBytes: input.referenceImageBytes,
    referenceMimeType: input.referenceMimeType,
    surface: 'gallery',
    errorLabel: 'Flux reference gallery generation failed',
  });

export const generateChatImageFromReferenceWithFlux = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    referenceImageBytes: input.referenceImageBytes,
    referenceMimeType: input.referenceMimeType,
    surface: 'chat',
    kontextOptions: input.kontextOptions,
    preferDevModel: input.preferDevModel,
    errorLabel: 'Flux reference chat generation failed',
  });
