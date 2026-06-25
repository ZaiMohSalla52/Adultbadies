import { describe, expect, it } from 'vitest';
import { parseExplicitExposure } from '@/lib/virtual-girlfriend/explicit-exposure';
import { resolvePhotoGenerationSpec } from '@/lib/virtual-girlfriend/photo-generation-spec';

describe('parseExplicitExposure', () => {
  it('detects topless requests with no bra', () => {
    const spec = parseExplicitExposure('i want to see your tits with no bra on');
    expect(spec.level).toBe('topless');
    expect(spec.wardrobeInstruction.toLowerCase()).toContain('no bra');
    expect(spec.kontextEditInstruction.toLowerCase()).toContain('topless');
  });

  it('detects standalone nude and naked as full nude', () => {
    expect(parseExplicitExposure('send me a nude pic').level).toBe('full_nude');
    expect(parseExplicitExposure('show me naked').level).toBe('full_nude');
  });

  it('forces phone selfie pose when user asks for selfie', () => {
    const spec = parseExplicitExposure('send me your tits no bra, holding phone taking selfie');
    expect(spec.level).toBe('topless');
    expect(spec.kontextEditInstruction.toLowerCase()).toContain('smartphone');
    expect(spec.framing.toLowerCase()).toContain('selfie');
  });

  it('detects ass requests as butt_focus exposure', () => {
    const spec = parseExplicitExposure('show me your ass');
    expect(spec.level).toBe('butt_focus');
    expect(spec.wardrobeInstruction.toLowerCase()).toContain('bare ass');
    expect(spec.kontextEditInstruction.toLowerCase()).toContain('buttocks');
  });

  it('detects bent over ass pose', () => {
    const spec = parseExplicitExposure('bend over and show me your ass');
    expect(spec.level).toBe('butt_focus');
    expect(spec.kontextEditInstruction.toLowerCase()).toContain('bent');
  });

  it('does not inject lingerie wardrobe into explicit photo spec', () => {
    const photoSpec = resolvePhotoGenerationSpec('i want to see your tits with no bra on', {
      sex: 'female',
      styleVibe: 'lingerie',
    });
    expect(photoSpec.explicit).toBe(true);
    expect(photoSpec.exposureLevel).toBe('topless');
    expect(photoSpec.sceneDirective.toLowerCase()).toContain('no bra');
    expect(photoSpec.sceneDirective.toLowerCase()).not.toMatch(/wardrobe:.*lace lingerie/);
  });
});