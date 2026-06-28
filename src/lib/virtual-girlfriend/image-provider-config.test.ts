import { describe, expect, it } from 'vitest';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';

describe('resolveVgImageProvider', () => {
  it('defaults to flux for identity images', () => {
    const priorProvider = process.env.VG_IMAGE_PROVIDER;
    const priorKey = process.env.MODELSLAB_API_KEY;
    delete process.env.VG_IMAGE_PROVIDER;
    process.env.MODELSLAB_API_KEY = 'test-key';
    expect(resolveVgImageProvider()).toBe('flux');
    if (priorProvider === undefined) delete process.env.VG_IMAGE_PROVIDER;
    else process.env.VG_IMAGE_PROVIDER = priorProvider;
    if (priorKey === undefined) delete process.env.MODELSLAB_API_KEY;
    else process.env.MODELSLAB_API_KEY = priorKey;
  });

  it('honors explicit modelslab for explicit chat routing only', () => {
    const priorProvider = process.env.VG_IMAGE_PROVIDER;
    process.env.VG_IMAGE_PROVIDER = 'modelslab';
    expect(resolveVgImageProvider()).toBe('modelslab');
    if (priorProvider === undefined) delete process.env.VG_IMAGE_PROVIDER;
    else process.env.VG_IMAGE_PROVIDER = priorProvider;
  });
});