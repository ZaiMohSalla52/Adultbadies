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
  generateGalleryImageFromReferenceWithTogether: vi.fn(),
}));

vi.mock('@/lib/virtual-girlfriend/image-modelslab', () => ({
  generatePortraitPreviewImageWithModelsLab: vi.fn(),
  generateCanonicalImageWithModelsLab: vi.fn(),
  generateGalleryImageFromReferenceWithModelsLab: vi.fn(),
  generateChatImageFromReferenceWithModelsLab: vi.fn(),
  generateChatImageWithModelsLabFaceGen: vi.fn(),
}));

import { generatePortraitPreviewImage } from '@/lib/virtual-girlfriend/image-provider';
import { generatePortraitPreviewImageWithTogether } from '@/lib/virtual-girlfriend/image-together';

describe('image-provider hybrid routing', () => {
  const priorKey = process.env.TOGETHER_API_KEY;
  const priorOverride = process.env.VG_PORTRAIT_PROVIDER;

  afterEach(() => {
    if (priorKey === undefined) delete process.env.TOGETHER_API_KEY;
    else process.env.TOGETHER_API_KEY = priorKey;
    if (priorOverride === undefined) delete process.env.VG_PORTRAIT_PROVIDER;
    else process.env.VG_PORTRAIT_PROVIDER = priorOverride;
    vi.clearAllMocks();
  });

  it('uses Together for portrait previews when TOGETHER_API_KEY is set', async () => {
    process.env.TOGETHER_API_KEY = 'test-key';
    delete process.env.VG_PORTRAIT_PROVIDER;

    await generatePortraitPreviewImage('test prompt', 10101);
    expect(generatePortraitPreviewImageWithTogether).toHaveBeenCalledWith('test prompt', 10101);
  });
});