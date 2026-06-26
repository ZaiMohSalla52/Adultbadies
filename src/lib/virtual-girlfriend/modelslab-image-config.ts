import { env } from '@/lib/env';

/**
 * Default portrait text2img — Aurelium (Phase 0 bake-off winner).
 *
 * Do NOT default to ModelsLab `flux` or fal Flux Pro for setup portraits: adult-leaning
 * companion traits (seductive, lingerie) trigger black-card blanks on Flux hosts.
 * Explicit/nude chat never uses this model — see image-generation-router (Kontext dev / Face Gen).
 */
export const MODELSLAB_DEFAULT_PORTRAIT_MODEL =
  'aurelium-photorealistic-people-bysilas-v1-0-1771498462';

/** Setup portrait picker — four candidates improve face diversity at selection time. */
export const PORTRAIT_PREVIEW_CANDIDATE_COUNT = 4;

/** Gallery + identity-lock img2img (Phase 0b bake-off winner for scene variety). */
export const MODELSLAB_DEFAULT_KONTEXT_PRO_MODEL = 'flux-kontext-pro';

/** LoRA trigger token used by flux-realistic-portrait-v2-0 in ModelsLab examples. */
export const MODELSLAB_REALISTIC_PORTRAIT_PROMPT_PREFIX = 'R3alisticF, ';

export const resolveModelsLabPortraitModel = () =>
  env.MODELSLAB_PORTRAIT_MODEL?.trim() ||
  env.MODELSLAB_FLUX_MODEL?.trim() ||
  MODELSLAB_DEFAULT_PORTRAIT_MODEL;

/** Softer explicit chat img2img — keep on Aurelium/SDXL, separate from portrait override. */
export const resolveModelsLabSdxlModel = () =>
  env.MODELSLAB_SDXL_MODEL?.trim() ||
  'aurelium-photorealistic-people-bysilas-v1-0-1771498462';

export const isModelsLabRealisticPortraitModel = (modelId: string) =>
  /realistic-portrait|realism/i.test(modelId) && !/aurelium/i.test(modelId);

export const applyModelsLabPortraitPrompt = (prompt: string, modelId: string) => {
  if (/aurelium/i.test(modelId)) return prompt;
  if (!isModelsLabRealisticPortraitModel(modelId) || /r3alisticf/i.test(prompt)) {
    return prompt;
  }
  return `${MODELSLAB_REALISTIC_PORTRAIT_PROMPT_PREFIX}${prompt}`;
};