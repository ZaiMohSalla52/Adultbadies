import { describe, expect, it } from 'vitest';
import {
  FAL_FLUX_GALLERY_MODEL,
  FAL_FLUX_PORTRAIT_MODEL,
  resolveFalFluxGalleryModel,
  resolveFalFluxPortraitModel,
} from '@/lib/virtual-girlfriend/flux-image-config';

describe('flux-image-config', () => {
  it('locks portrait to fal-ai/flux/dev', () => {
    expect(resolveFalFluxPortraitModel()).toBe(FAL_FLUX_PORTRAIT_MODEL);
    expect(FAL_FLUX_PORTRAIT_MODEL).toBe('fal-ai/flux/dev');
  });

  it('locks gallery to fal-ai/flux-kontext/dev', () => {
    expect(resolveFalFluxGalleryModel()).toBe(FAL_FLUX_GALLERY_MODEL);
    expect(FAL_FLUX_GALLERY_MODEL).toBe('fal-ai/flux-kontext/dev');
  });
});