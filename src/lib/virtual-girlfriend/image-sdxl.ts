import { env } from '@/lib/env';
import {
  callModelsLabV6Images,
  uploadReferenceImageUrl,
} from '@/lib/virtual-girlfriend/modelslab-client';
import { buildFaceGenExplicitPrompt } from '@/lib/virtual-girlfriend/photo-generation-spec';
import { buildModelsLabNegativePrompt } from '@/lib/virtual-girlfriend/prompt-builder/primitives/negatives';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';

/*
 * SDXL provider for explicit in-chat images only.
 *
 * Uses ModelsLab img2img with the companion canonical face as init_image so
 * explicit scenes stay face-locked without Flux Kontext pro's black-image gate.
 */

const MODELSLAB_SDXL_MODEL = env.MODELSLAB_SDXL_MODEL ?? 'sdxl';
const MODELSLAB_NEGATIVE_PROMPT = buildModelsLabNegativePrompt();

const DIMENSIONS_BY_ASPECT: Record<string, { width: number; height: number }> = {
  '1x1': { width: 1024, height: 1024 },
  '3x4': { width: 768, height: 1024 },
  '4x3': { width: 1024, height: 768 },
  '9x16': { width: 576, height: 1024 },
  '16x9': { width: 1024, height: 576 },
};

const resolveDimensions = (aspectRatio: string) =>
  DIMENSIONS_BY_ASPECT[aspectRatio] ?? DIMENSIONS_BY_ASPECT['3x4']!;

const extractGeneratedImage = async (
  payload: Awaited<ReturnType<typeof callModelsLabV6Images>>,
  model: string,
): Promise<GeneratedImage> => {
  const temporaryUrl = payload.output?.[0];
  if (!temporaryUrl) {
    throw new Error('SDXL image generation returned no image URL.');
  }

  const response = await fetch(temporaryUrl);
  if (!response.ok) {
    throw new Error(`SDXL temporary image download failed (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') ?? 'image/png',
    width: typeof payload.meta?.width === 'number' ? payload.meta.width : null,
    height: typeof payload.meta?.height === 'number' ? payload.meta.height : null,
    revisedPrompt: null,
    provider: 'modelslab',
    model,
    endpoint: '/v6/images/img2img',
    requestId: payload.id != null ? String(payload.id) : null,
    jobId: payload.id != null ? String(payload.id) : null,
    temporaryUrl,
  };
};

const resolveReferenceInitImage = async (
  reference: { bytes: Buffer; mimeType: string } | { url: string },
) => {
  if ('url' in reference && /^https?:\/\//i.test(reference.url.trim())) {
    return reference.url.trim();
  }

  if ('bytes' in reference && reference.bytes.byteLength) {
    return uploadReferenceImageUrl(reference.bytes, reference.mimeType);
  }

  throw new Error('SDXL explicit generation requires a hosted face URL or reference image bytes.');
};

export const generateExplicitChatImageWithModelsLabSdxl = async (input: {
  prompt: string;
  userMessage?: string;
  reference: { bytes: Buffer; mimeType: string } | { url: string };
  numInferenceSteps?: number;
  guidanceScale?: number;
  highExposure?: boolean;
}): Promise<GeneratedImage> => {
  const chatParams = SURFACE_PARAMS.chat;
  const { width, height } = resolveDimensions(chatParams.aspect_ratio);
  const initImage = await resolveReferenceInitImage(input.reference);
  const guidanceScale = input.guidanceScale ?? (input.highExposure ? 7.5 : 6.5);
  const numInferenceSteps = input.numInferenceSteps ?? (input.highExposure ? 36 : 32);
  const explicitPrompt = input.userMessage?.trim()
    ? buildFaceGenExplicitPrompt(input.userMessage.trim())
    : input.prompt;

  const payload = await callModelsLabV6Images(
    'img2img',
    {
      model_id: MODELSLAB_SDXL_MODEL,
      prompt: explicitPrompt,
      negative_prompt: MODELSLAB_NEGATIVE_PROMPT,
      init_image: initImage,
      width,
      height,
      samples: chatParams.num_images,
      num_inference_steps: numInferenceSteps,
      guidance: guidanceScale,
      // Low strength kept the canonical clothed portrait — not enough denoise for nudity.
      strength: input.highExposure ? 0.78 : 0.68,
      safety_checker: 'no',
      enhance_prompt: false,
    },
    'ModelsLab SDXL explicit chat generation failed',
    { maxAttempts: 45, intervalMs: 1_500 },
  );

  return extractGeneratedImage(payload, MODELSLAB_SDXL_MODEL);
};