import { describe, expect, it } from 'vitest';
import {
  MODELSLAB_DEFAULT_PORTRAIT_MODEL,
  applyModelsLabPortraitPrompt,
  resolveModelsLabPortraitModel,
} from '@/lib/virtual-girlfriend/modelslab-image-config';

describe('modelslab-image-config', () => {
  it('defaults portrait model to flux-realistic-portrait-v2-0', () => {
    const priorPortrait = process.env.MODELSLAB_PORTRAIT_MODEL;
    const priorFlux = process.env.MODELSLAB_FLUX_MODEL;
    delete process.env.MODELSLAB_PORTRAIT_MODEL;
    delete process.env.MODELSLAB_FLUX_MODEL;

    expect(resolveModelsLabPortraitModel()).toBe(MODELSLAB_DEFAULT_PORTRAIT_MODEL);

    if (priorPortrait === undefined) delete process.env.MODELSLAB_PORTRAIT_MODEL;
    else process.env.MODELSLAB_PORTRAIT_MODEL = priorPortrait;
    if (priorFlux === undefined) delete process.env.MODELSLAB_FLUX_MODEL;
    else process.env.MODELSLAB_FLUX_MODEL = priorFlux;
  });

  it('adds the realistic portrait trigger token for portrait models', () => {
    const prompt = applyModelsLabPortraitPrompt('portrait of a woman', MODELSLAB_DEFAULT_PORTRAIT_MODEL);
    expect(prompt.startsWith('R3alisticF,')).toBe(true);
    expect(prompt.includes('portrait of a woman')).toBe(true);
  });

  it('does not duplicate the trigger token', () => {
    const prompt = applyModelsLabPortraitPrompt('R3alisticF, portrait of a woman', MODELSLAB_DEFAULT_PORTRAIT_MODEL);
    expect(prompt).toBe('R3alisticF, portrait of a woman');
  });
});