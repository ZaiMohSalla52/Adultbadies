import { describe, expect, it } from 'vitest';
import {
  isTogetherGalleryEnabled,
  isTogetherPortraitEnabled,
  resolveTogetherGalleryModel,
  resolveTogetherPortraitModel,
  TOGETHER_DEFAULT_GALLERY_MODEL,
  TOGETHER_DEFAULT_PORTRAIT_MODEL,
} from './together-image-config';

describe('together-image-config', () => {
  it('defaults portrait model to FLUX.2-max', () => {
    expect(resolveTogetherPortraitModel()).toBe(TOGETHER_DEFAULT_PORTRAIT_MODEL);
    expect(TOGETHER_DEFAULT_PORTRAIT_MODEL).toBe('black-forest-labs/FLUX.2-max');
  });

  it('defaults gallery model to FLUX.1-kontext-max', () => {
    expect(resolveTogetherGalleryModel()).toBe(TOGETHER_DEFAULT_GALLERY_MODEL);
    expect(TOGETHER_DEFAULT_GALLERY_MODEL).toBe('black-forest-labs/FLUX.1-kontext-max');
  });

  it('enables together portrait when API key is set', () => {
    const priorKey = process.env.TOGETHER_API_KEY;
    const priorOverride = process.env.VG_PORTRAIT_PROVIDER;
    process.env.TOGETHER_API_KEY = 'test-key';
    delete process.env.VG_PORTRAIT_PROVIDER;
    expect(isTogetherPortraitEnabled()).toBe(true);
    process.env.VG_PORTRAIT_PROVIDER = 'modelslab';
    expect(isTogetherPortraitEnabled()).toBe(false);
    if (priorKey === undefined) delete process.env.TOGETHER_API_KEY;
    else process.env.TOGETHER_API_KEY = priorKey;
    if (priorOverride === undefined) delete process.env.VG_PORTRAIT_PROVIDER;
    else process.env.VG_PORTRAIT_PROVIDER = priorOverride;
  });

  it('enables together gallery when API key is set', () => {
    const priorKey = process.env.TOGETHER_API_KEY;
    const priorOverride = process.env.VG_GALLERY_PROVIDER;
    process.env.TOGETHER_API_KEY = 'test-key';
    delete process.env.VG_GALLERY_PROVIDER;
    expect(isTogetherGalleryEnabled()).toBe(true);
    process.env.VG_GALLERY_PROVIDER = 'modelslab';
    expect(isTogetherGalleryEnabled()).toBe(false);
    if (priorKey === undefined) delete process.env.TOGETHER_API_KEY;
    else process.env.TOGETHER_API_KEY = priorKey;
    if (priorOverride === undefined) delete process.env.VG_GALLERY_PROVIDER;
    else process.env.VG_GALLERY_PROVIDER = priorOverride;
  });
});