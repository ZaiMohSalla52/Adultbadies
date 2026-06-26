import { env } from '@/lib/env';

/**
 * Default portrait text2img — ModelsLab `flux` (~10s, reliable in Phase 0 bake-off).
 * Override with MODELSLAB_PORTRAIT_MODEL (e.g. flux-realistic-portrait-v2-0 or Aurelium).
 */
export const MODELSLAB_DEFAULT_PORTRAIT_MODEL = 'flux';

/** Setup portrait picker — keep low to conserve ModelsLab credits. */
export const PORTRAIT_PREVIEW_CANDIDATE_COUNT = 2;

/** Gallery + identity-lock img2img (Phase 0b bake-off winner for scene variety). */
export const MODELSLAB_DEFAULT_KONTEXT_PRO_MODEL = 'flux-kontext-pro';

/** LoRA trigger token used by flux-realistic-portrait-v2-0 in ModelsLab examples. */
export const MODELSLAB_REALISTIC_PORTRAIT_PROMPT_PREFIX = 'R3alisticF, ';

export const resolveModelsLabPortraitModel = () =>
  env.MODELSLAB_PORTRAIT_MODEL?.trim() ||
  env.MODELSLAB_FLUX_MODEL?.trim() ||
  MODELSLAB_DEFAULT_PORTRAIT_MODEL;

/** Explicit chat img2img — defaults to Aurelium when unset (faster than Face Gen). */
export const resolveModelsLabSdxlModel = () =>
  env.MODELSLAB_SDXL_MODEL?.trim() || resolveModelsLabPortraitModel();

export const isModelsLabRealisticPortraitModel = (modelId: string) =>
  /realistic-portrait|realism/i.test(modelId) && !/aurelium/i.test(modelId);

export const applyModelsLabPortraitPrompt = (prompt: string, modelId: string) => {
  if (/aurelium/i.test(modelId)) return prompt;
  if (!isModelsLabRealisticPortraitModel(modelId) || /r3alisticf/i.test(prompt)) {
    return prompt;
  }
  return `${MODELSLAB_REALISTIC_PORTRAIT_PROMPT_PREFIX}${prompt}`;
};