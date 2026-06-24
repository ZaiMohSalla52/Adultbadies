import { env } from '@/lib/env';
import { isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import { buildPreviewNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';

/*
 * Flux provider (fal.ai) — sole image provider.
 *
 * Exposes the generation surface consumed by image-provider.ts / image-machine.
 *
 * - Base text-to-image generation uses FLUX_MODEL (default fal-ai/flux/dev).
 * - Reference / identity-lock generation uses FLUX_KONTEXT_MODEL
 *   (default fal-ai/flux-pro/kontext) to keep the same face across the canonical,
 *   gallery, and chat surfaces ("same person, new scene/outfit").
 *
 * Adult-capable chat: when VG_ALLOW_ADULT_CONTENT is enabled (default), chat
 * Kontext calls disable fal's safety checker so explicit in-chat images are not
 * blocked at the provider. Identity-lock surfaces (preview/canonical/gallery)
 * keep the checker on and retain SFW negatives for stable reference portraits.
 */

const FLUX_BASE_URL = env.FLUX_BASE_URL ?? 'https://fal.run';
const FLUX_MODEL = env.FLUX_MODEL ?? 'fal-ai/flux/dev';
const FLUX_KONTEXT_MODEL = env.FLUX_KONTEXT_MODEL ?? 'fal-ai/flux-pro/kontext';

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
): Promise<GeneratedImage> => {
  const payload = (await response.json()) as FalImageResult;
  const generated = payload.images?.[0];
  const temporaryUrl = generated?.url;
  if (!temporaryUrl) {
    throw new Error('Flux image generation returned no image URL.');
  }

  const imageResponse = await fetch(temporaryUrl);
  if (!imageResponse.ok) {
    throw new Error(`Flux temporary image download failed (${imageResponse.status}).`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();

  return {
    bytes: Buffer.from(arrayBuffer),
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

const falProviderOptions = (surface: 'preview' | 'canonical' | 'gallery' | 'chat') => {
  if (surface === 'chat' && isVirtualGirlfriendAdultContentEnabled()) {
    // Kontext applies two independent moderation gates: `enable_safety_checker`
    // (a boolean post-gen checker) and `safety_tolerance` (1 = strict … 5 =
    // permissive, default "2"). Disabling only the checker still leaves the
    // strict default tolerance in place, which blanks flagged/borderline
    // content to a solid black image — so adult chat photos came back black.
    // Raise tolerance to the most permissive value alongside disabling the
    // checker so explicit in-chat images render instead of returning black.
    return { enable_safety_checker: false, safety_tolerance: '5' };
  }

  return {};
};

export const generateCanonicalImageWithFlux = async (prompt: string): Promise<GeneratedImage> => {
  const canonicalParams = SURFACE_PARAMS.canonical;
  const response = await callFal(
    FLUX_MODEL,
    {
      prompt,
      image_size: resolveImageSize(canonicalParams.aspect_ratio),
      num_images: canonicalParams.num_images,
      output_format: 'png',
    },
    'Flux image generation failed',
  );

  return extractGeneratedImage(response, FLUX_MODEL);
};

export const generatePortraitPreviewImageWithFlux = async (
  prompt: string,
  seed?: number,
): Promise<GeneratedImage> => {
  const previewParams = SURFACE_PARAMS.preview;
  const response = await callFal(
    FLUX_MODEL,
    {
      prompt: withNegatives(prompt, buildPreviewNegativePrompt()),
      image_size: resolveImageSize(previewParams.aspect_ratio),
      num_images: previewParams.num_images,
      output_format: 'png',
      ...(seed !== undefined ? { seed } : {}),
    },
    'Flux portrait preview generation failed',
  );

  return extractGeneratedImage(response, FLUX_MODEL);
};

const generateKontextFromReference = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  surface: 'preview' | 'canonical' | 'gallery' | 'chat';
  withPreviewNegatives?: boolean;
  seed?: number;
  errorLabel: string;
}): Promise<GeneratedImage> => {
  const surfaceParams = SURFACE_PARAMS[input.surface];
  const prompt = input.withPreviewNegatives
    ? withNegatives(input.prompt, buildPreviewNegativePrompt())
    : input.prompt;

  const response = await callFal(
    FLUX_KONTEXT_MODEL,
    {
      prompt,
      image_url: toDataUri(input.referenceImageBytes, input.referenceMimeType),
      aspect_ratio: resolveKontextAspect(surfaceParams.aspect_ratio),
      num_images: surfaceParams.num_images,
      output_format: 'png',
      ...falProviderOptions(input.surface),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    },
    input.errorLabel,
  );

  return extractGeneratedImage(response, FLUX_KONTEXT_MODEL);
};

export const generatePreviewWithCharacterReferenceFlux = async (
  prompt: string,
  referenceImageBytes: Buffer,
  referenceMimeType: string,
  seed?: number,
): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt,
    referenceImageBytes,
    referenceMimeType,
    surface: 'preview',
    withPreviewNegatives: true,
    seed,
    errorLabel: 'Flux character reference generation failed',
  });

export const generateCanonicalImageFromReferenceWithFlux = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  imageWeight?: number;
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    referenceImageBytes: input.referenceImageBytes,
    referenceMimeType: input.referenceMimeType,
    surface: 'canonical',
    errorLabel: 'Flux canonical generation with selected portrait reference failed',
  });

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
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    referenceImageBytes: input.referenceImageBytes,
    referenceMimeType: input.referenceMimeType,
    surface: 'chat',
    errorLabel: 'Flux reference chat generation failed',
  });
