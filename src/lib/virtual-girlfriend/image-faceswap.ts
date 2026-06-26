import { env } from '@/lib/env';
import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import type { WardrobeContext } from '@/lib/virtual-girlfriend/companion-wardrobe';
import {
  callModelsLabFaceSwap,
  callModelsLabV6Images,
  downloadModelsLabImage,
  uploadReferenceImageUrl,
  type ModelsLabApiResponse,
} from '@/lib/virtual-girlfriend/modelslab-client';
import { resolveModelsLabSdxlModel } from '@/lib/virtual-girlfriend/modelslab-image-config';
import {
  buildFaceGenExplicitPrompt,
  FACE_GEN_BASE_NEGATIVE_PROMPT,
  FACE_GEN_CROP_NEGATIVE_PROMPT,
  resolveFaceGenExplicitParams,
} from '@/lib/virtual-girlfriend/photo-generation-spec';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';

/*
 * Explicit chat via body scene + face swap (ModelsLab single-face-swap).
 *
 * Faster and more reliable for rear-view / pose-heavy shots than Face Gen,
 * which often queues 60–120s+ and times out inside Vercel's 270s budget.
 *
 * Step 1: text2img uncensored body scene (no identity lock)
 * Step 2: swap canonical companion face onto the scene (<2s typical)
 */

const MODELSLAB_FACE_SWAP_MODEL = env.MODELSLAB_FACE_SWAP_MODEL ?? 'single-face-swap';
const MODELSLAB_EXPLICIT_BODY_MODEL =
  env.MODELSLAB_EXPLICIT_BODY_MODEL ?? resolveModelsLabSdxlModel();

const EXPLICIT_BODY_DIMENSIONS = { width: 768, height: 1024 } as const;

const BODY_SCENE_POLL = { maxAttempts: 40, intervalMs: 1_500 } as const;
const FACE_SWAP_POLL = { maxAttempts: 20, intervalMs: 1_000 } as const;

const resolveFaceImageUrl = async (reference: { bytes: Buffer; mimeType: string } | { url: string }) => {
  if ('url' in reference && /^https?:\/\//i.test(reference.url.trim())) {
    return reference.url.trim();
  }
  if ('bytes' in reference && reference.bytes.byteLength) {
    return uploadReferenceImageUrl(reference.bytes, reference.mimeType);
  }
  throw new Error('Face swap requires a hosted face URL or reference image bytes.');
};

/** Body scene prompt — composition without identity lock (face swap handles identity). */
export const buildExplicitBodyScenePrompt = (message: string, context: WardrobeContext = {}) =>
  buildFaceGenExplicitPrompt(message, context).replace(/,?\s*same face as reference\.?/gi, '').trim();

const extractGeneratedImage = async (
  payload: ModelsLabApiResponse,
  model: string,
  endpoint: string,
): Promise<GeneratedImage> => {
  const temporaryUrl = payload.output?.[0];
  if (!temporaryUrl) {
    throw new Error('ModelsLab face swap pipeline returned no image URL.');
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

export const generateExplicitChatImageWithModelsLabFaceSwap = async (input: {
  userMessage: string;
  reference: { bytes: Buffer; mimeType: string } | { url: string };
  wardrobeContext?: WardrobeContext;
}): Promise<GeneratedImage> => {
  const wardrobeContext = input.wardrobeContext ?? {};
  const explicit = detectExplicitImageIntent(input.userMessage);
  if (!explicit) {
    throw new Error('Face swap explicit pipeline requires an explicit user message.');
  }

  const faceImage = await resolveFaceImageUrl(input.reference);
  const bodyPrompt = buildExplicitBodyScenePrompt(input.userMessage, wardrobeContext);
  const explicitParams = resolveFaceGenExplicitParams(input.userMessage, wardrobeContext);
  const negativePrompt = [
    FACE_GEN_BASE_NEGATIVE_PROMPT,
    FACE_GEN_CROP_NEGATIVE_PROMPT,
    'clothed, dressed, shirt, bra, crop top, jeans, pants, underwear, covered chest, covered breasts',
  ].join(', ');

  const chatParams = SURFACE_PARAMS.chat;
  const bodyPayload = await callModelsLabV6Images(
    'text2img',
    {
      model_id: MODELSLAB_EXPLICIT_BODY_MODEL,
      prompt: bodyPrompt,
      negative_prompt: negativePrompt,
      width: EXPLICIT_BODY_DIMENSIONS.width,
      height: EXPLICIT_BODY_DIMENSIONS.height,
      samples: chatParams.num_images,
      num_inference_steps: 31,
      guidance_scale: explicitParams.guidanceScale ?? 7.5,
      safety_checker: 'no',
      enhance_prompt: false,
    },
    'ModelsLab explicit body scene generation failed',
    BODY_SCENE_POLL,
  );

  const bodySceneUrl = bodyPayload.output?.[0];
  if (!bodySceneUrl) {
    throw new Error('ModelsLab explicit body scene returned no image URL.');
  }

  const swapPayload = await callModelsLabFaceSwap(
    {
      model_id: MODELSLAB_FACE_SWAP_MODEL,
      init_image: faceImage,
      target_image: bodySceneUrl,
      watermark: 'no',
    },
    'ModelsLab single face swap failed',
    FACE_SWAP_POLL,
  );

  return extractGeneratedImage(swapPayload, MODELSLAB_FACE_SWAP_MODEL, '/v6/faceswap/single_face_swap');
};