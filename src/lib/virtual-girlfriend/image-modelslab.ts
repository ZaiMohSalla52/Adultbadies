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
  MODELSLAB_DEFAULT_KONTEXT_PRO_MODEL,
  resolveModelsLabPortraitModel,
} from '@/lib/virtual-girlfriend/modelslab-image-config';
import {
  AURELIUM_PORTRAIT_NEGATIVE_PROMPT,
  buildAureliumPortraitApiPrompt,
  isAureliumPortraitModel,
} from '@/lib/virtual-girlfriend/modelslab-aurelium-template';
import { isUsablePortraitImageBytes } from '@/lib/virtual-girlfriend/image-luminance';
import { buildModelsLabNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import type { GeneratedImage, KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

export type { KontextGenerationOptions } from '@/lib/virtual-girlfriend/image-types';

/*
 * ModelsLab image provider — Phase 1 stack:
 *
 * Portrait preview / fallback canonical text2img → Aurelium (MODELSLAB_PORTRAIT_MODEL, safety_checker off)
 * Setup canonical from selected portrait → direct persist (image-machine, no API)
 * Gallery from canonical → flux-kontext-pro (v7 img2img)
 * Adult explicit chat → Face Gen first; img2img fallback for sexual requested-look / failures
 * Passive adult chat img2img fallback → flux-kontext-dev (v6, safety_checker off)
 */

const MODELSLAB_PORTRAIT_MODEL = resolveModelsLabPortraitModel();
const MODELSLAB_KONTEXT_PRO_MODEL =
  env.MODELSLAB_KONTEXT_PRO_MODEL ?? MODELSLAB_DEFAULT_KONTEXT_PRO_MODEL;
const MODELSLAB_KONTEXT_DEV_MODEL = env.MODELSLAB_KONTEXT_DEV_MODEL ?? 'flux-kontext-dev';
const MODELSLAB_FACE_GEN_MODEL = env.MODELSLAB_FACE_GEN_MODEL ?? 'ai-avatar-generatorface-gen';
const FACE_GEN_NEGATIVE_PROMPT =
  'drawing, cartoon, anime, big nose, long nose, fat, ugly, bad anatomy, worst quality, low quality, blurry, censored, black bar, mosaic, watermark, text, logo, bra, shirt covering chest when topless requested, jeans covering ass when bare ass requested, panties covering when explicit rear requested';
const MODELSLAB_NEGATIVE_PROMPT = buildModelsLabNegativePrompt();

const PREVIEW_POLL = { maxAttempts: 45, intervalMs: 1_500 } as const;

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

const isAdultChatSurface = (surface: 'gallery' | 'chat') =>
  surface === 'chat' && isVirtualGirlfriendAdultContentEnabled();

const kontextModelForSurface = (
  surface: 'gallery' | 'chat',
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

const deriveAureliumSeed = (seed: number | undefined, prompt: string) => {
  if (seed !== undefined) return seed;
  let hash = 0;
  for (let i = 0; i < prompt.length; i += 1) {
    hash = (hash * 31 + prompt.charCodeAt(i)) >>> 0;
  }
  return hash % 2_147_483_647 || 40_404;
};

const buildModelsLabText2ImgRequest = (input: {
  modelId: string;
  prompt: string;
  width: number;
  height: number;
  samples: number;
  numInferenceSteps: number;
  guidanceScale: number;
  seed?: number;
  useAureliumTemplate?: boolean;
}) => {
  const useAurelium = input.useAureliumTemplate ?? isAureliumPortraitModel(input.modelId);
  const corePrompt = applyModelsLabPortraitPrompt(input.prompt, input.modelId);
  const seed = useAurelium ? deriveAureliumSeed(input.seed, corePrompt) : input.seed;
  const prompt = useAurelium
    ? buildAureliumPortraitApiPrompt({ corePrompt, seed: seed! })
    : corePrompt;

  return {
    model_id: input.modelId,
    prompt,
    negative_prompt: useAurelium ? AURELIUM_PORTRAIT_NEGATIVE_PROMPT : MODELSLAB_NEGATIVE_PROMPT,
    enhance_prompt: useAurelium ? 'yes' : false,
    width: input.width,
    height: input.height,
    samples: input.samples,
    num_inference_steps: input.numInferenceSteps,
    guidance_scale: input.guidanceScale,
    safety_checker: 'no',
    scheduler: useAurelium ? 'UniPCMultistepScheduler' : 'DPMSolverMultistepScheduler',
    ...(seed !== undefined ? { seed } : {}),
  };
};

const strengthForKontext = (input: {
  surface: 'gallery' | 'chat';
  guidanceScale?: number;
  explicitHighExposure?: boolean;
}) => {
  if (input.surface === 'gallery') {
    return 0.42;
  }

  if (input.explicitHighExposure) {
    return 0.84;
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

  if (
    endpoint.includes('text2img')
    && !isUsablePortraitImageBytes(downloaded.bytes)
  ) {
    throw new Error('ModelsLab portrait generation returned a blank or near-black image.');
  }

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
      numInferenceSteps: 28,
      guidanceScale: 7.5,
      useAureliumTemplate: true,
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

  // Return the ModelsLab CDN URL immediately; delivery re-hosts to R2/Cloudinary.
  return extractGeneratedImage(payload, MODELSLAB_PORTRAIT_MODEL, '/v6/images/text2img', {
    skipDownload: true,
  });
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
  surface: 'gallery' | 'chat';
  seed?: number;
  errorLabel: string;
  kontextOptions?: KontextGenerationOptions;
  preferDevModel?: boolean;
  explicitHighExposure?: boolean;
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
        strength: strengthForKontext({
          surface: input.surface,
          guidanceScale,
          explicitHighExposure: input.explicitHighExposure,
        }),
        safety_checker: safetyChecker ? 'yes' : 'no',
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
      },
      input.errorLabel,
    );

    return extractGeneratedImage(payload, model, '/v6/images/img2img');
  }

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
  );

  return extractGeneratedImage(payload, model, '/v7/images/image-to-image');
};

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
    { maxAttempts: 60, intervalMs: 1_500 },
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
  explicitHighExposure?: boolean;
}): Promise<GeneratedImage> =>
  generateKontextFromReference({
    prompt: input.prompt,
    referenceImageBytes: input.referenceImageBytes,
    referenceMimeType: input.referenceMimeType,
    surface: 'chat',
    kontextOptions: input.kontextOptions,
    preferDevModel: input.preferDevModel,
    explicitHighExposure: input.explicitHighExposure,
    errorLabel: 'ModelsLab reference chat generation failed',
  });