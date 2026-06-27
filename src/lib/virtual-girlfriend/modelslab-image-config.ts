import { env } from '@/lib/env';
import { isAureliumPortraitModel } from '@/lib/virtual-girlfriend/modelslab-aurelium-template';

/**
 * Default setup portrait — Flux 2 Pro v7 (diversity trio bake-off winner).
 * Fallback: realvisxl-v30 when primary times out or errors.
 *
 * Override via MODELSLAB_PORTRAIT_MODEL / MODELSLAB_PORTRAIT_FALLBACK_MODEL.
 * Explicit/nude chat never uses this stack — see image-generation-router (Face Gen / swap).
 */
export const MODELSLAB_DEFAULT_PORTRAIT_MODEL = 'flux-2-pro';

export const MODELSLAB_DEFAULT_PORTRAIT_FALLBACK_MODEL = 'realvisxl-v30';

/** Setup portrait picker — four candidates improve face diversity at selection time. */
export const PORTRAIT_PREVIEW_CANDIDATE_COUNT = 4;

/** Gallery + identity-lock img2img (Phase 0b bake-off winner for scene variety). */
export const MODELSLAB_DEFAULT_KONTEXT_PRO_MODEL = 'flux-kontext-pro';

/** LoRA trigger token used by flux-realistic-portrait-v2-0 in ModelsLab examples. */
export const MODELSLAB_REALISTIC_PORTRAIT_PROMPT_PREFIX = 'R3alisticF, ';

export const isFlux2ProPortraitModel = (modelId: string) => /flux-2-pro/i.test(modelId);

export const isRealVisXlPortraitModel = (modelId: string) => /realvisxl/i.test(modelId);

export const resolveModelsLabPortraitModel = () =>
  env.MODELSLAB_PORTRAIT_MODEL?.trim() ||
  env.MODELSLAB_FLUX_MODEL?.trim() ||
  MODELSLAB_DEFAULT_PORTRAIT_MODEL;

export const resolveModelsLabPortraitFallbackModel = () =>
  env.MODELSLAB_PORTRAIT_FALLBACK_MODEL?.trim() || MODELSLAB_DEFAULT_PORTRAIT_FALLBACK_MODEL;

/** Softer explicit chat img2img — keep on Aurelium/SDXL, separate from portrait override. */
export const resolveModelsLabSdxlModel = () =>
  env.MODELSLAB_SDXL_MODEL?.trim() ||
  'aurelium-photorealistic-people-bysilas-v1-0-1771498462';

export const isModelsLabRealisticPortraitModel = (modelId: string) =>
  /realistic-portrait|realism/i.test(modelId) && !/aurelium/i.test(modelId);

export const applyModelsLabPortraitPrompt = (prompt: string, modelId: string) => {
  if (isFlux2ProPortraitModel(modelId) || isAureliumPortraitModel(modelId)) return prompt;
  if (!isModelsLabRealisticPortraitModel(modelId) || /r3alisticf/i.test(prompt)) {
    return prompt;
  }
  return `${MODELSLAB_REALISTIC_PORTRAIT_PROMPT_PREFIX}${prompt}`;
};