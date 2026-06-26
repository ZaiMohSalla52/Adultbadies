import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import type { WardrobeContext } from '@/lib/virtual-girlfriend/companion-wardrobe';
import {
  callModelsLabFaceGen,
  callModelsLabFaceSwap,
  downloadModelsLabImage,
  ensureModelsLabHostedImageUrl,
  type ModelsLabApiResponse,
} from '@/lib/virtual-girlfriend/modelslab-client';
import {
  buildFaceGenExplicitPrompt,
  FACE_GEN_BASE_NEGATIVE_PROMPT,
  FACE_GEN_CROP_NEGATIVE_PROMPT,
  FACE_GEN_MAX_HEIGHT,
  FACE_GEN_MAX_WIDTH,
  resolveFaceGenExplicitParams,
} from '@/lib/virtual-girlfriend/photo-generation-spec';
import type { GeneratedImage } from '@/lib/virtual-girlfriend/image-types';
import { env } from '@/lib/env';

/*
 * Explicit chat: Face Gen body scene + face swap (ModelsLab single-face-swap).
 * No separate SDXL/cyberrealistic text2img — that path produced poor body quality.
 *
 * Step 1: Face Gen uncensored body scene (low s_scale, composition-first prompt)
 * Step 2: swap canonical companion face onto the scene
 * On failure → Face Gen only (image-machine fallback)
 */

const MODELSLAB_FACE_GEN_MODEL = env.MODELSLAB_FACE_GEN_MODEL ?? 'ai-avatar-generatorface-gen';
const MODELSLAB_FACE_SWAP_ENDPOINT = 'single_face_swap';

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
  const explicit = detectExplicitImageIntent(input.userMessage);
  if (!explicit) {
    throw new Error('Face swap explicit pipeline requires an explicit user message.');
  }

  const faceImage = await ensureModelsLabHostedImageUrl(input.reference);
  const bodyPrompt = buildExplicitBodyScenePrompt(input.userMessage, wardrobeContext);
  const explicitParams = resolveFaceGenExplicitParams(input.userMessage, wardrobeContext);
  const negativePrompt = [
    FACE_GEN_BASE_NEGATIVE_PROMPT,
    FACE_GEN_CROP_NEGATIVE_PROMPT,
    'clothed, dressed, shirt, bra, crop top, jeans, pants, underwear, covered chest, covered breasts',
  ].join(', ');

  const bodyPayload = await callModelsLabFaceGen(
    {
      model_id: MODELSLAB_FACE_GEN_MODEL,
      face_image: faceImage,
      prompt: bodyPrompt,
      style: 'realistic',
      negative_prompt: negativePrompt,
      width: explicitParams.width ?? FACE_GEN_MAX_WIDTH,
      height: explicitParams.height ?? FACE_GEN_MAX_HEIGHT,
      s_scale: explicitParams.sScale ?? 0.52,
      guidance_scale: explicitParams.guidanceScale ?? 7.5,
      safety_checker: false,
      num_inference_steps: 31,
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

  return extractGeneratedImage(
    swapPayload,
    MODELSLAB_FACE_GEN_MODEL,
    `/v6/faceswap/${MODELSLAB_FACE_SWAP_ENDPOINT}`,
  );
};