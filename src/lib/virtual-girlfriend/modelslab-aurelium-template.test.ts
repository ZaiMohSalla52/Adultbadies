import { describe, expect, it } from 'vitest';
import {
  AURELIUM_QUALITY_SUFFIX,
  appendAureliumGalleryQuality,
  buildAureliumPortraitApiPrompt,
  isAureliumPortraitModel,
} from '@/lib/virtual-girlfriend/modelslab-aurelium-template';

describe('modelslab-aurelium-template', () => {
  it('detects Aurelium checkpoint ids', () => {
    expect(isAureliumPortraitModel('aurelium-photorealistic-people-bysilas-v1-0-1771498462')).toBe(true);
    expect(isAureliumPortraitModel('flux')).toBe(false);
  });

  it('wraps trait prompts with playground template and seed', () => {
    const prompt = buildAureliumPortraitApiPrompt({
      corePrompt: 'Adult woman, age 24, long dark brown hair.',
      seed: 30_303,
    });
    expect(prompt).toContain('Close portrait photorealistic seed 30303 hyperrealistic');
    expect(prompt).toContain('long dark brown hair');
    expect(prompt).toContain(AURELIUM_QUALITY_SUFFIX);
    expect(prompt).toContain('trending on instagram');
  });

  it('appends gallery quality tail once', () => {
    const once = appendAureliumGalleryQuality('Portrait in a café.');
    const twice = appendAureliumGalleryQuality(once);
    expect(once).toContain('HDR photorealistic');
    expect(twice).toBe(once);
  });
});