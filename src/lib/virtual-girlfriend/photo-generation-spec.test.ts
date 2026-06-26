import { describe, expect, it } from 'vitest';
import {
  buildExplicitImg2ImgPrompt,
  resolveExplicitImg2ImgStrength,
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
    expect(params.sScale).toBeLessThan(0.6);
    expect(params.prompt.toLowerCase()).toContain('head to toe');
    expect(params.prompt.toLowerCase()).toContain('feet');
    expect(params.prompt.toLowerCase()).toContain('nipples');
    expect(params.negativePrompt.toLowerCase()).toContain('headshot only');
    expect(params.negativePrompt.toLowerCase()).toContain('cropped at hips');
    expect(params.negativePrompt.toLowerCase()).toContain('crop top');
  });

  it('builds chest-visible Face Gen params for topless requests', () => {
    const params = resolveFaceGenExplicitParams('show me your tits', { sex: 'female' });
    expect(params.prompt.toLowerCase()).toContain('nipples fully visible');
    expect(params.sScale).toBeGreaterThan(0.6);
    expect(params.sScale).toBeLessThan(0.75);
  });

  it('builds wide rear-view Face Gen params for ass requests', () => {
    const params = resolveFaceGenExplicitParams('show me your ass', { sex: 'female' });
    expect(params.prompt.toLowerCase()).toContain('rear-view');
    expect(params.prompt.toLowerCase()).toContain('feet');
    expect(params.sScale).toBeLessThan(0.6);
  });

  it('loosens face lock further on wide framing retry', () => {
    const normal = resolveFaceGenExplicitParams('show me your ass', { sex: 'female' });
    const wide = resolveFaceGenExplicitParams('show me your ass', { sex: 'female' }, { wideFraming: true });
    expect(wide.sScale).toBeLessThan(normal.sScale);
    expect(wide.prompt.toLowerCase()).toContain('wide shot');
    expect(wide.wideFraming).toBe(true);
  });

  it('builds rear-view img2img fallback prompt for ass requests', () => {
    const prompt = buildExplicitImg2ImgPrompt('show me your ass', { sex: 'female' });
    expect(prompt.toLowerCase()).toContain('rear-view');
    expect(prompt.toLowerCase()).toContain('ignore reference pose');
    expect(prompt.toLowerCase()).toContain('no jeans');
  });

  it('uses very high img2img strength for butt focus', () => {
    expect(resolveExplicitImg2ImgStrength('butt_focus')).toBeGreaterThan(0.9);
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