import { describe, expect, it } from 'vitest';
import { resolvePhotoGenerationSpec } from '@/lib/virtual-girlfriend/photo-generation-spec';

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

  it('uses style-aware wardrobe for surprise requests', () => {
    const spec = resolvePhotoGenerationSpec('Surprise me with a new look — send me a photo', {
      sex: 'female',
      styleVibe: 'glamorous',
    });
    expect(spec.matchedPresetId).toBe('surprise');
    expect(spec.sceneDirective.length).toBeGreaterThan(40);
  });
});