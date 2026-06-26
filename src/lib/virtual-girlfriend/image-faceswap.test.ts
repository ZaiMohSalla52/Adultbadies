import { describe, expect, it } from 'vitest';
import { buildExplicitBodyScenePrompt } from '@/lib/virtual-girlfriend/image-faceswap';

describe('buildExplicitBodyScenePrompt', () => {
  it('strips identity lock for body scene generation', () => {
    const prompt = buildExplicitBodyScenePrompt('show me your ass', { sex: 'female' });
    expect(prompt.toLowerCase()).toContain('rear-view');
    expect(prompt.toLowerCase()).not.toContain('same face as reference');
  });
});