import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/virtual-girlfriend/image-together', () => ({
  generatePortraitPreviewImageWithTogether: vi.fn(async () => ({
    bytes: Buffer.alloc(0),
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    revisedPrompt: null,
    provider: 'together',
    model: 'black-forest-labs/FLUX.2-max',
    endpoint: '/v1/images/generations',
    requestId: null,
    jobId: null,
    temporaryUrl: 'https://example.com/portrait.jpg',
  })),
  generateCanonicalImageWithTogether: vi.fn(),
  generateGalleryImageFromReferenceWithTogether: vi.fn(async () => ({
    bytes: Buffer.from('gallery'),
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    revisedPrompt: null,
    provider: 'together',
    model: 'black-forest-labs/FLUX.1-kontext-max',
    endpoint: '/v1/images/generations',
    requestId: null,
    jobId: null,
    temporaryUrl: null,
  })),
}));

vi.mock('@/lib/virtual-girlfriend/image-modelslab', () => ({
  generatePortraitPreviewImageWithModelsLab: vi.fn(),
  generateCanonicalImageWithModelsLab: vi.fn(),
  generateGalleryImageFromReferenceWithModelsLab: vi.fn(),
  generateChatImageFromReferenceWithModelsLab: vi.fn(),
  generateChatImageWithModelsLabFaceGen: vi.fn(),
}));

import {
  generateGalleryImageFromReference,
  generatePortraitPreviewImage,
} from '@/lib/virtual-girlfriend/image-provider';
import {
  generateGalleryImageFromReferenceWithTogether,
  generatePortraitPreviewImageWithTogether,
} from '@/lib/virtual-girlfriend/image-together';
import { generateGalleryImageFromReferenceWithModelsLab } from '@/lib/virtual-girlfriend/image-modelslab';

describe('image-provider Together-only routing', () => {
  const priorKey = process.env.TOGETHER_API_KEY;
  const priorPortraitOverride = process.env.VG_PORTRAIT_PROVIDER;
  const priorGalleryOverride = process.env.VG_GALLERY_PROVIDER;

  afterEach(() => {
    if (priorKey === undefined) delete process.env.TOGETHER_API_KEY;
    else process.env.TOGETHER_API_KEY = priorKey;
    if (priorPortraitOverride === undefined) delete process.env.VG_PORTRAIT_PROVIDER;
    else process.env.VG_PORTRAIT_PROVIDER = priorPortraitOverride;
    if (priorGalleryOverride === undefined) delete process.env.VG_GALLERY_PROVIDER;
    else process.env.VG_GALLERY_PROVIDER = priorGalleryOverride;
    vi.clearAllMocks();
  });

  it('uses Together for portrait previews when TOGETHER_API_KEY is set', async () => {
    process.env.TOGETHER_API_KEY = 'test-key';
    delete process.env.VG_PORTRAIT_PROVIDER;

    await generatePortraitPreviewImage('test prompt', 10101);
    expect(generatePortraitPreviewImageWithTogether).toHaveBeenCalledWith('test prompt', 10101);
  });

  it('uses Together for gallery when TOGETHER_API_KEY is set', async () => {
    process.env.TOGETHER_API_KEY = 'test-key';
    delete process.env.VG_GALLERY_PROVIDER;

    await generateGalleryImageFromReference({
      prompt: 'gallery prompt',
      referenceImageBytes: Buffer.from('ref'),
      referenceMimeType: 'image/jpeg',
      referenceImageUrl: 'https://cdn.example.com/canonical.jpg',
    });

    expect(generateGalleryImageFromReferenceWithTogether).toHaveBeenCalledWith({
      prompt: 'gallery prompt',
      referenceImageBytes: Buffer.from('ref'),
      referenceMimeType: 'image/jpeg',
      referenceImageUrl: 'https://cdn.example.com/canonical.jpg',
    });
    expect(generateGalleryImageFromReferenceWithModelsLab).not.toHaveBeenCalled();
  });

  it('does not fall back to ModelsLab when Together portrait fails', async () => {
    process.env.TOGETHER_API_KEY = 'test-key';
    delete process.env.VG_PORTRAIT_PROVIDER;

    vi.mocked(generatePortraitPreviewImageWithTogether).mockRejectedValueOnce(
      new Error('Together portrait generation failed: Rate limit exceeded'),
    );

    await expect(generatePortraitPreviewImage('test prompt')).rejects.toThrow(/Rate limit exceeded/);
    expect(generatePortraitPreviewImageWithTogether).toHaveBeenCalledTimes(1);
  });
});