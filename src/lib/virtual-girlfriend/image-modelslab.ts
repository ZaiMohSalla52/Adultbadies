import { env } from '@/lib/env';
import { isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import {
  callModelsLabV6Images,
  callModelsLabV7ImageToImage,
  downloadModelsLabImage,
  type ModelsLabApiResponse,
  uploadReferenceImageUrl,
} from '@/lib/virtual-girlfriend/modelslab-client';
import { buildPreviewNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

export type { KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * ModelsLab image provider — Flux text2img + Flux Kontext pro/dev.
 *
 * Canonical identity lock uses flux-kontext-pro (v7 image-to-image) with the
 * selected portrait as init_image — same "same person, new scene/outfit" model
 * family as fal Kontext pro, used for preview, canonical, and gallery surfaces.
 *
 * Adult chat routes to flux-kontext-dev (v6 img2img) with safety_checker off.
 */

const MODELSLAB_FLUX_MODEL = env.MODELSLAB_FLUX_MODEL ?? 'flux';
const MODELSLAB_KONTEXT_PRO_MODEL = env.MODELSLAB_KONTEXT_PRO_MODEL ?? 'flux-kontext-pro';
const MODELSLAB_KONTEXT_DEV_MODEL = env.MODELSLAB_KONTEXT_DEV_MODEL ?? 'flux-kontext-dev';

const PREVIEW_POLL = { maxAttempts: 22, intervalMs: 1_000 } as const;

const DIMENSIONS_BY_ASPECT: Record<string, { width: number; height: number }> = {
  '1x1': { width: 1024, height: 1024 },
  '3x4': { width: 768, height: 1024 },
  '4x3': { width: 1024, height: 768 },
  '9x16': { width: 576, height: 1024 },
  '16x9': { width: 1024, height: 576 },
};

const KONTEXT_ASPECT_BY_SURFACE: Record<string, string> = {
  '1x1': '1:1',
  '3x4': '3:4',
  '4x3': '4:3',
  '9x16': '9:16',
  '16x9': '16:9',
};

const resolveDimensions = (aspectRatio: string) =>
  DIMENSIONS_BY_ASPECT[aspectRatio] ?? DIMENSIONS_BY_ASPECT['3x4']!;

/** Smaller preview size keeps setup portrait generation under serverless limits. */
const PREVIEW_DIMENSIONS_BY_ASPECT: Record<string, { width: number; height: number }> = {
  '1x1': { width: 768, height: 768 },
  '3x4': { width: 576, height: 768 },
  '4x3': { width: 768, height: 576 },
  '9x16': { width: 432, height: 768 },
  '16x9': { width: 768, height: 432 },
};

const resolvePreviewDimensions = (aspectRatio: string) =>
  PREVIEW_DIMENSIONS_BY_ASPECT[aspectRatio] ?? PREVIEW_DIMENSIONS_BY_ASPECT['3x4']!;

const resolveKontextAspect = (aspectRatio: string) => KONTEXT_ASPECT_BY_SURFACE[aspectRatio] ?? '3:4';

const withNegatives = (prompt: string, negatives: string) =>
  negatives.trim() ? `${prompt}\nAvoid: ${negatives}` : prompt;

const isAdultChatSurface = (surface: 'preview' | 'canonical' | 'gallery' | 'chat') =>
  surface === 'chat' && isVirtualGirlfriendAdultContentEnabled();

const kontextModelForSurface = (
  surface: 'preview' | 'canonical' | 'gallery' | 'chat',
  options?: { preferDevModel?: boolean },
) => {
  if (surface === 'chat' && (isAdultChatSurface(surface) || options?.preferDevModel)) {
    return MODELSLAB_KONTEXT_DEV_MODEL;
  }
  return MODELSLAB_KONTEXT_PRO_MODEL;
};

const isKontextDevModel = (model: string) => /kontext-dev/i.test(model);

const strengthForKontext = (input: {
  surface: 'preview' | 'canonical' | 'gallery' | 'chat';
  guidanceScale?: number;
}) => {
  if (input.surface === 'canonical' || input.surface === 'preview' || input.surface === 'gallery') {
    return 0.42;
  }

  const guidance = input.guidanceScale ?? 5;
  return Math.min(0.72, Math.max(0.48, guidance / 12));
};

const extractGeneratedImage = async (
  payload: ModelsLabApiResponse,
  model: string,
  endpoint: string,
  options?: { skipDownload?: boolean },
): Promise<GeneratedImage> => {
  const temporaryUrl = payload.output?.[0];
  if (!temporaryUrl) {
    throw new Error('ModelsLab image generation returned no image URL.');
  }

  if (options?.skipDownload) {
    return {
      bytes: Buffer.alloc(0),
      mimeType: 'image/png',
      width: typeof payload.meta?.width === 'number' ? payload.meta.width : null,
      height: typeof payload.meta?.height === 'number' ? payload.meta.height : null,
      revisedPrompt: null,
      provider: 'modelslab',
      model,
      endpoint,
      requestId: payload.id != null ? String(payload.id) : null,
      jobId: payload.id != null ? String(payload.id) : null,
      temporaryUrl,
    };
  }

  const downloaded = await downloadModelsLabImage(temporaryUrl);

  return {
    bytes: downloaded.bytes,
    mimeType: downloaded.mimeType,
    width: typeof payload.meta?.width === 'number' ? payload.meta.width : null,
    height: typeof payload.meta?.height === 'number' ? payload.meta.height : null,
    revisedPrompt: null,
    provider: 'modelslab',
    model,
    endpoint,
    requestId: payload.id != null ? String(payload.id) : null,
    jobId: payload.id != null ? String(payload.id) : null,
    temporaryUrl,
  };
};

export const generateCanonicalImageWithModelsLab = async (prompt: string): Promise<GeneratedImage> => {
  const canonicalParams = SURFACE_PARAMS.canonical;
  const { width, height } = resolveDimensions(canonicalParams.aspect_ratio);
  const payload = await callModelsLabV6Images(
    'text2img',
    {
      model_id: MODELSLAB_FLUX_MODEL,
      prompt,
      width,
      height,
      samples: canonicalParams.num_images,
      num_inference_steps: 31,
      guidance_scale: 7.5,
      safety_checker: 'yes',
    },
    'ModelsLab canonical image generation failed',
  );

  return extractGeneratedImage(payload, MODELSLAB_FLUX_MODEL, '/v6/images/text2img');
};

export const generatePortraitPreviewImageWithModelsLab = async (
  prompt: string,
  seed?: number,
): Promise<GeneratedImage> => {
  const previewParams = SURFACE_PARAMS.preview;
  const { width, height } = resolvePreviewDimensions(previewParams.aspect_ratio);
  const payload = await callModelsLabV6Images(
    'text2img',
    {
      model_id: MODELSLAB_FLUX_MODEL,
      prompt: withNegatives(prompt, buildPreviewNegativePrompt()),
      width,
      height,
      samples: previewParams.num_images,
      num_inference_steps: 22,
      guidance_scale: 7,
      safety_checker: 'yes',
      ...(seed !== undefined ? { seed } : {}),
    },
    'ModelsLab portrait preview generation failed',
    PREVIEW_POLL,
  );

  return extractGeneratedImage(payload, MODELSLAB_FLUX_MODEL, '/v6/images/text2img', { skipDownload: true });
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
  const model = kontextModelForSurface(input.surface, { preferDevModel: input.preferDevModel });
  const prompt = input.withPreviewNegatives
    ? withNegatives(input.prompt, buildPreviewNegativePrompt())
    : input.prompt;
  const initImage = await uploadReferenceImageUrl(input.referenceImageBytes, input.referenceMimeType);

  const defaultSafety = isAdultChatSurface(input.surface) ? false : true;
  const safetyChecker = input.kontextOptions?.enableSafetyChecker ?? defaultSafety;
  const guidanceScale = input.kontextOptions?.guidanceScale;
  const numInferenceSteps = input.kontextOptions?.numInferenceSteps ?? 28;

  if (isKontextDevModel(model)) {
    const { width, height } = resolveDimensions(surfaceParams.aspect_ratio);
    const payload = await callModelsLabV6Images(
      'img2img',
      {
        model_id: model,
        prompt,
        init_image: initImage,
        width,
        height,
        samples: surfaceParams.num_images,
        num_inference_steps: numInferenceSteps,
        guidance: guidanceScale ?? 5,
        strength: strengthForKontext({ surface: input.surface, guidanceScale }),
        safety_checker: safetyChecker,
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
      },
      input.errorLabel,
    );

    return extractGeneratedImage(payload, model, '/v6/images/img2img');
  }

  const payload = await callModelsLabV7ImageToImage(
    {
      model_id: model,
      prompt,
      init_image: initImage,
      aspect_ratio: resolveKontextAspect(surfaceParams.aspect_ratio),
    },
    input.errorLabel,
  );

  return extractGeneratedImage(payload, model, '/v7/images/image-to-image');
};

export const generatePreviewWithCharacterReferenceModelsLab = async (
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
    errorLabel: 'ModelsLab character reference generation failed',
  });

export const generateCanonicalImageFromReferenceWithModelsLab = async (input: {
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
    errorLabel: 'ModelsLab canonical generation with selected portrait reference failed',
  });

export const generateGalleryImageFromReferenceWithModelsLab = async (input: {
  prompt: string;
  referenceImageBytes: Buffer;
  referenceMimeType: string;
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    referenceImageBytes: input.referenceImageBytes,
    referenceMimeType: input.referenceMimeType,
    surface: 'gallery',
    errorLabel: 'ModelsLab reference gallery generation failed',
  });

export const generateChatImageFromReferenceWithModelsLab = async (input: {
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
    errorLabel: 'ModelsLab reference chat generation failed',
  });