import { describe, expect, it } from 'vitest';
import { buildExplicitBodyScenePrompt } from '@/lib/virtual-girlfriend/image-faceswap';
import {
  MODELSLAB_DEFAULT_EXPLICIT_BODY_MODEL,
  resolveModelsLabExplicitBodyModel,
} from '@/lib/virtual-girlfriend/modelslab-image-config';

describe('buildExplicitBodyScenePrompt', () => {
  it('strips identity lock for body scene generation', () => {
    const prompt = buildExplicitBodyScenePrompt('show me your ass', { sex: 'female' });
    expect(prompt.toLowerCase()).toContain('rear-view');
    expect(prompt.toLowerCase()).not.toContain('same face as reference');
  });
});

describe('explicit body model defaults', () => {
  it('defaults to cyberrealistic NSFW SDXL for face-swap body scenes', () => {
    expect(MODELSLAB_DEFAULT_EXPLICIT_BODY_MODEL).toBe('cyberrealistic-xl-desire-desire-v1-0-dmd2');
    expect(resolveModelsLabExplicitBodyModel()).toBe(MODELSLAB_DEFAULT_EXPLICIT_BODY_MODEL);
  });
});