import { describe, expect, it } from 'vitest';
import {
  resolveFaceGenExplicitParams,
  resolvePhotoGenerationSpec,
} from '@/lib/virtual-girlfriend/photo-generation-spec';

describe('resolvePhotoGenerationSpec', () => {
  it('matches bikini requests by keyword without exact preset message', () => {
    const spec = resolvePhotoGenerationSpec('can you send me a bikini pic?', { sex: 'female', styleVibe: 'seductive' });
    expect(spec.matchedPresetId).toBe('bikini');
    expect(spec.sceneDirective.toLowerCase()).toContain('bikini');
    expect(spec.requestedLook).toBe(true);
  });

  it('builds explicit directives from natural language', () => {
    const spec = resolvePhotoGenerationSpec('show me your tits', { sex: 'female', styleVibe: 'lingerie' });
    expect(spec.explicit).toBe(true);
    expect(spec.imageCategory).toBe('indoor');
    expect(spec.sceneDirective.toLowerCase()).toContain('explicit');
  });

  it('treats ass requests as explicit with butt exposure level', () => {
    const spec = resolvePhotoGenerationSpec('show me your ass', { sex: 'female' });
    expect(spec.explicit).toBe(true);
    expect(spec.exposureLevel).toBe('butt_focus');
    expect(spec.sceneDirective.toLowerCase()).toContain('buttocks');
  });

  it('builds full-body Face Gen params for nude requests', () => {
    const params = resolveFaceGenExplicitParams('send me a nude photo of you', { sex: 'female' });
    expect(params.width).toBe(512);
    expect(params.height).toBe(768);
    expect(params.sScale).toBeLessThan(0.8);
    expect(params.prompt.toLowerCase()).toContain('head to toe');
    expect(params.prompt.toLowerCase()).toContain('nipples');
    expect(params.negativePrompt.toLowerCase()).toContain('headshot only');
    expect(params.negativePrompt.toLowerCase()).toContain('crop top');
  });

  it('builds chest-visible Face Gen params for topless requests', () => {
    const params = resolveFaceGenExplicitParams('show me your tits', { sex: 'female' });
    expect(params.prompt.toLowerCase()).toContain('nipples fully visible');
    expect(params.sScale).toBeGreaterThan(0.7);
  });

  it('uses style-aware wardrobe for surprise requests', () => {
    const spec = resolvePhotoGenerationSpec('Surprise me with a new look — send me a photo', {
      sex: 'female',
      styleVibe: 'glamorous',
    });
    expect(spec.matchedPresetId).toBe('surprise');
    expect(spec.sceneDirective.length).toBeGreaterThan(40);
  });
});