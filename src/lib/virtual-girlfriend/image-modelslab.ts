import { env } from '@/lib/env';
import { isVirtualGirlfriendAdultContentEnabled } from '@/lib/virtual-girlfriend/adult-content';
import {
  callModelsLabFaceGen,
  callModelsLabV6Images,
  callModelsLabV7ImageToImage,
  downloadModelsLabImage,
  type ModelsLabApiResponse,
  uploadReferenceImageUrl,
} from '@/lib/virtual-girlfriend/modelslab-client';
import { buildFaceGenChatPrompt } from '@/lib/virtual-girlfriend/photo-generation-spec';
import type { WardrobeContext } from '@/lib/virtual-girlfriend/companion-wardrobe';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import {
  applyModelsLabPortraitPrompt,
  resolveModelsLabPortraitModel,
} from '@/lib/virtual-girlfriend/modelslab-image-config';
import { buildModelsLabNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

export type { KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * ModelsLab image provider — photorealistic Flux portraits + Flux Kontext pro/dev.
 *
 * Portrait text2img defaults to flux-realistic-portrait-v2-0 (not generic `flux`,
 * which skews anime/stylized). Canonical identity lock uses flux-kontext-pro (v7
 * image-to-image) with the selected portrait as init_image.
 *
 * Adult chat routes to flux-kontext-dev (v6 img2img) with safety_checker off.
 */

const MODELSLAB_PORTRAIT_MODEL = resolveModelsLabPortraitModel();
const MODELSLAB_KONTEXT_PRO_MODEL = env.MODELSLAB_KONTEXT_PRO_MODEL ?? 'flux-kontext-pro';
const MODELSLAB_KONTEXT_DEV_MODEL = env.MODELSLAB_KONTEXT_DEV_MODEL ?? 'flux-kontext-dev';
const MODELSLAB_FACE_GEN_MODEL = env.MODELSLAB_FACE_GEN_MODEL ?? 'ai-avatar-generatorface-gen';
const FACE_GEN_NEGATIVE_PROMPT =
  'drawing, cartoon, anime, big nose, long nose, fat, ugly, bad anatomy, worst quality, low quality, blurry, censored, black bar, mosaic, watermark, text, logo, bra, shirt covering chest when topless requested, jeans covering ass when bare ass requested, panties covering when explicit rear requested';
const MODELSLAB_NEGATIVE_PROMPT = buildModelsLabNegativePrompt();

const PREVIEW_POLL = { maxAttempts: 28, intervalMs: 1_000 } as const;
const PREVIEW_KONTEXT_POLL = { maxAttempts: 24, intervalMs: 1_000 } as const;

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

/** Portrait previews use full surface dimensions for photorealism. */
const resolvePreviewDimensions = (aspectRatio: string) => resolveDimensions(aspectRatio);

const resolveKontextAspect = (aspectRatio: string) => KONTEXT_ASPECT_BY_SURFACE[aspectRatio] ?? '3:4';

const isAdultChatSurface = (surface: 'preview' | 'canonical' | 'gallery' | 'chat') =>
  surface === 'chat' && isVirtualGirlfriendAdultContentEnabled();

const kontextModelForSurface = (
  surface: 'preview' | 'canonical' | 'gallery' | 'chat',
  options?: { preferDevModel?: boolean; forceDevModel?: boolean },
) => {
  // Kontext Pro is moderated — never route adult / uncensored chat through it.
  if (
    surface === 'chat'
    && (options?.forceDevModel || isAdultChatSurface(surface) || options?.preferDevModel)
  ) {
    return MODELSLAB_KONTEXT_DEV_MODEL;
  }
  return MODELSLAB_KONTEXT_PRO_MODEL;
};

const isKontextDevModel = (model: string) => /kontext-dev/i.test(model);

const buildModelsLabText2ImgRequest = (input: {
  modelId: string;
  prompt: string;
  width: number;
  height: number;
  samples: number;
  numInferenceSteps: number;
  guidanceScale: number;
  seed?: number;
}) => ({
  model_id: input.modelId,
  prompt: applyModelsLabPortraitPrompt(input.prompt, input.modelId),
  negative_prompt: MODELSLAB_NEGATIVE_PROMPT,
  enhance_prompt: false,
  width: input.width,
  height: input.height,
  samples: input.samples,
  num_inference_steps: input.numInferenceSteps,
  guidance_scale: input.guidanceScale,
  safety_checker: 'yes',
  scheduler: 'DPMSolverMultistepScheduler',
  ...(input.seed !== undefined ? { seed: input.seed } : {}),
});

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
    buildModelsLabText2ImgRequest({
      modelId: MODELSLAB_PORTRAIT_MODEL,
      prompt,
      width,
      height,
      samples: canonicalParams.num_images,
      numInferenceSteps: 31,
      guidanceScale: 7.5,
    }),
    'ModelsLab canonical image generation failed',
  );

  return extractGeneratedImage(payload, MODELSLAB_PORTRAIT_MODEL, '/v6/images/text2img');
};

export const generatePortraitPreviewImageWithModelsLab = async (
  prompt: string,
  seed?: number,
): Promise<GeneratedImage> => {
  const previewParams = SURFACE_PARAMS.preview;
  const { width, height } = resolvePreviewDimensions(previewParams.aspect_ratio);
  const payload = await callModelsLabV6Images(
    'text2img',
    buildModelsLabText2ImgRequest({
      modelId: MODELSLAB_PORTRAIT_MODEL,
      prompt,
      width,
      height,
      samples: previewParams.num_images,
      numInferenceSteps: 28,
      guidanceScale: 7.5,
      seed,
    }),
    'ModelsLab portrait preview generation failed',
    PREVIEW_POLL,
  );

  return extractGeneratedImage(payload, MODELSLAB_PORTRAIT_MODEL, '/v6/images/text2img');
};

const resolveReferenceInitImage = async (input: {
  referenceImageBytes?: Buffer;
  referenceMimeType?: string;
  referenceImageUrl?: string;
}) => {
  const hostedUrl = input.referenceImageUrl?.trim();
  if (hostedUrl && /^https?:\/\//i.test(hostedUrl)) {
    return hostedUrl;
  }

  if (!input.referenceImageBytes?.byteLength || !input.referenceMimeType) {
    throw new Error('Reference image bytes or hosted URL are required for Kontext generation.');
  }

  return uploadReferenceImageUrl(input.referenceImageBytes, input.referenceMimeType);
};

const generateKontextFromReference = async (input: {
  prompt: string;
  referenceImageBytes?: Buffer;
  referenceMimeType?: string;
  referenceImageUrl?: string;
  surface: 'preview' | 'canonical' | 'gallery' | 'chat';
  seed?: number;
  errorLabel: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
  skipDownload?: boolean;
}): Promise<GeneratedImage> => {
  const surfaceParams = SURFACE_PARAMS[input.surface];
  const model = kontextModelForSurface(input.surface, {
    preferDevModel: input.preferDevModel,
    forceDevModel: input.surface === 'chat' && input.kontextOptions?.enableSafetyChecker === false,
  });
  const prompt = input.prompt;
  const initImage = await resolveReferenceInitImage(input);

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
        safety_checker: safetyChecker ? 'yes' : 'no',
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
      },
      input.errorLabel,
    );

    return extractGeneratedImage(payload, model, '/v6/images/img2img');
  }

  const pollOptions = input.surface === 'preview' ? PREVIEW_KONTEXT_POLL : undefined;
  const payload = await callModelsLabV7ImageToImage(
    {
      model_id: model,
      prompt: applyModelsLabPortraitPrompt(prompt, model),
      negative_prompt: MODELSLAB_NEGATIVE_PROMPT,
      enhance_prompt: false,
      init_image: initImage,
      aspect_ratio: resolveKontextAspect(surfaceParams.aspect_ratio),
    },
    input.errorLabel,
    pollOptions,
  );

  return extractGeneratedImage(payload, model, '/v7/images/image-to-image', {
    skipDownload: input.skipDownload,
  });
};

export const generatePreviewWithCharacterReferenceModelsLab = async (
  prompt: string,
  reference: { bytes: Buffer; mimeType: string } | { url: string },
  seed?: number,
): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt,
    ...( 'url' in reference
      ? { referenceImageUrl: reference.url }
      : { referenceImageBytes: reference.bytes, referenceMimeType: reference.mimeType }),
    surface: 'preview',
    seed,
    errorLabel: 'ModelsLab character reference generation failed',
    skipDownload: true,
  });

export const generateCanonicalImageFromReferenceWithModelsLab = async (input: {
  prompt: string;
  reference: { bytes: Buffer; mimeType: string } | { url: string };
  imageWeight?: number;
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    ...('url' in input.reference
      ? { referenceImageUrl: input.reference.url }
      : { referenceImageBytes: input.reference.bytes, referenceMimeType: input.reference.mimeType }),
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

const resolveFaceImageUrl = async (reference: { bytes: Buffer; mimeType: string } | { url: string }) => {
  if ('url' in reference && /^https?:\/\//i.test(reference.url.trim())) {
    return reference.url.trim();
  }
  if ('bytes' in reference && reference.bytes.byteLength) {
    return uploadReferenceImageUrl(reference.bytes, reference.mimeType);
  }
  throw new Error('Face Gen requires a hosted face URL or reference image bytes.');
};

export const generateChatImageWithModelsLabFaceGen = async (input: {
  userMessage: string;
  reference: { bytes: Buffer; mimeType: string } | { url: string };
  wardrobeContext?: WardrobeContext;
  numInferenceSteps?: number;
}): Promise<GeneratedImage> => {
  const faceImage = await resolveFaceImageUrl(input.reference);
  const prompt = buildFaceGenChatPrompt(input.userMessage, input.wardrobeContext);
  const payload = await callModelsLabFaceGen(
    {
      model_id: MODELSLAB_FACE_GEN_MODEL,
      face_image: faceImage,
      prompt,
      style: 'realistic',
      negative_prompt: FACE_GEN_NEGATIVE_PROMPT,
      num_inference_steps: input.numInferenceSteps ?? 41,
    },
    'ModelsLab Face Gen explicit chat generation failed',
    { maxAttempts: 120, intervalMs: 1_500 },
  );

  return extractGeneratedImage(payload, MODELSLAB_FACE_GEN_MODEL, '/v6/image_editing/face_gen');
};

/** @deprecated Use generateChatImageWithModelsLabFaceGen */
export const generateExplicitChatImageWithModelsLabFaceGen = generateChatImageWithModelsLabFaceGen;

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