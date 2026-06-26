import type { WardrobeContext } from '@/lib/virtual-girlfriend/companion-wardrobe';
import {
  callModelsLabFaceSwap,
  callModelsLabV6Images,
  downloadModelsLabImage,
  ensureModelsLabHostedImageUrl,
  type ModelsLabApiResponse,
} from '@/lib/virtual-girlfriend/modelslab-client';
import { resolveModelsLabExplicitBodyModel } from '@/lib/virtual-girlfriend/modelslab-image-config';
import {
  buildFaceGenExplicitPrompt,
  FACE_GEN_BASE_NEGATIVE_PROMPT,
  FACE_GEN_CROP_NEGATIVE_PROMPT,
  resolveFaceGenExplicitParams,
} from '@/lib/virtual-girlfriend/photo-generation-spec';
import { SURFACE_PARAMS } from '@/lib/virtual-girlfriend/image-surfaces';
import type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';

/*
 * Adult explicit chat — body scene + face swap only (ModelsLab single-face-swap).
 * No Face Gen / Kontext / SDXL fallbacks (saves credits).
 *
 * Step 1: text2img uncensored body scene (no identity lock)
 * Step 2: swap canonical companion face onto the scene
 */

const MODELSLAB_FACE_SWAP_ENDPOINT = 'single_face_swap';
const MODELSLAB_EXPLICIT_BODY_MODEL = resolveModelsLabExplicitBodyModel();

const EXPLICIT_BODY_DIMENSIONS = { width: 768, height: 1024 } as const;

const BODY_SCENE_POLL = { maxAttempts: 40, intervalMs: 1_500 } as const;
const FACE_SWAP_POLL = { maxAttempts: 60, intervalMs: 2_000 } as const;

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
  if (!input.userMessage.trim()) {
    throw new Error('Face swap chat generation requires a user message.');
  }

  const faceImage = await ensureModelsLabHostedImageUrl(input.reference);
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

  const hostedBodySceneUrl = await ensureModelsLabHostedImageUrl({ url: bodySceneUrl });

  const swapPayload = await callModelsLabFaceSwap(
    {
      init_image: hostedBodySceneUrl,
      target_image: faceImage,
      reference_image: faceImage,
      watermark: false,
      base64: false,
    },
    'ModelsLab single face swap failed',
    FACE_SWAP_POLL,
  );

  return extractGeneratedImage(swapPayload, MODELSLAB_EXPLICIT_BODY_MODEL, `/v6/faceswap/${MODELSLAB_FACE_SWAP_ENDPOINT}`);
};