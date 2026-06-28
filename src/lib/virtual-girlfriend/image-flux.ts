import { env } from '@/lib/env';
import { isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import {
  assertFluxApiKey,
  FAL_FLUX_GALLERY_MODEL,
  FAL_FLUX_PORTRAIT_MODEL,
  resolveFalFluxGalleryModel,
  resolveFalFluxPortraitModel,
} from '@/lib/virtual-girlfriend/flux-image-config';
import { isUsablePortraitImageBytes } from '@/lib/virtual-girlfriend/image-luminance';
import { buildPreviewNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

export type { KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

const FLUX_BASE_URL = env.FLUX_BASE_URL ?? 'https://fal.run';

const IMAGE_SIZE_BY_ASPECT: Record<string, string> = {
  '1x1': 'square_hd',
  '3x4': 'portrait_4_3',
  '4x3': 'landscape_4_3',
  '9x16': 'portrait_16_9',
  '16x9': 'landscape_16_9',
};

const KONTEXT_ASPECT_BY_SURFACE: Record<string, string> = {
  '1x1': '1:1',
  '3x4': '3:4',
  '4x3': '4:3',
  '9:16': '9:16',
  '16:9': '16:9',
};

const resolveImageSize = (aspectRatio: string) => IMAGE_SIZE_BY_ASPECT[aspectRatio] ?? 'portrait_4_3';
const resolveKontextAspect = (aspectRatio: string) => KONTEXT_ASPECT_BY_SURFACE[aspectRatio] ?? '3:4';

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
      Authorization: `Key ${assertFluxApiKey()}`,
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

const withNegatives = (prompt: string, negatives: string) =>
  negatives.trim() ? `${prompt}\nAvoid: ${negatives}` : prompt;

const portraitFluxDevBody = (input: {
  prompt: string;
  aspectRatio: string;
  seed?: number;
}) => ({
  prompt: input.prompt,
  image_size: resolveImageSize(input.aspectRatio),
  num_images: 1,
  output_format: 'jpeg',
  enable_safety_checker: false,
  ...(input.seed !== undefined ? { seed: input.seed } : {}),
});

const generatePortraitWithFluxDev = async (
  prompt: string,
  surface: 'preview' | 'canonical',
  seed?: number,
): Promise<GeneratedImage> => {
  const model = resolveFalFluxPortraitModel();
  const surfaceParams = SURFACE_PARAMS[surface];
  const response = await callFal(
    model,
    portraitFluxDevBody({ prompt, aspectRatio: surfaceParams.aspect_ratio, seed }),
    `Flux ${surface} generation failed (${model})`,
  );

  return extractGeneratedImage(response, model, { rejectBlankPortrait: true });
};

export const generateCanonicalImageWithFlux = async (prompt: string): Promise<GeneratedImage> =>
  generatePortraitWithFluxDev(prompt, 'canonical');

export const generatePortraitPreviewImageWithFlux = async (
  prompt: string,
  seed?: number,
): Promise<GeneratedImage> => generatePortraitWithFluxDev(prompt, 'preview', seed);

const generateKontextFromReference = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  surface: 'preview' | 'canonical' | 'gallery' | 'chat';
  withPreviewNegatives?: boolean;
  seed?: number;
  errorLabel: string;
  kontextOptions?: KontextGenerationOptions;
}): Promise<GeneratedImage> => {
  const surfaceParams = SURFACE_PARAMS[input.surface];
  const model = resolveFalFluxGalleryModel();
  const prompt = input.withPreviewNegatives
    ? withNegatives(input.prompt, buildPreviewNegativePrompt())
    : input.prompt;

  const safetyChecker =
    input.surface === 'chat' && isVirtualGirlfriendAdultContentEnabled()
      ? false
      : input.kontextOptions?.enableSafetyChecker ?? false;

  const response = await callFal(
    model,
    {
      prompt,
      image_url: toDataUri(input.referenceImageBytes, input.referenceMimeType),
      aspect_ratio: resolveKontextAspect(surfaceParams.aspect_ratio),
      num_images: surfaceParams.num_images,
      output_format: 'jpeg',
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
    errorLabel: `Flux gallery generation failed (${FAL_FLUX_GALLERY_MODEL})`,
  });

export const generateChatImageFromReferenceWithFlux = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
  kontextOptions?: KontextGenerationOptions;
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    referenceImageBytes: input.referenceImageBytes,
    referenceMimeType: input.referenceMimeType,
    surface: 'chat',
    kontextOptions: input.kontextOptions,
    errorLabel: `Flux chat generation failed (${FAL_FLUX_GALLERY_MODEL})`,
  });