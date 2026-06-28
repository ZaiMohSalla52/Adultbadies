import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/virtual-girlfriend/image-flux', () => ({
  generatePortraitPreviewImageWithFlux: vi.fn(async () => ({
    bytes: Buffer.alloc(0),
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    revisedPrompt: null,
    provider: 'flux',
    model: 'fal-ai/flux/dev',
    endpoint: '/fal-ai/flux/dev',
    requestId: null,
    jobId: null,
    temporaryUrl: 'https://example.com/portrait.jpg',
  })),
  generateCanonicalImageWithFlux: vi.fn(),
  generateGalleryImageFromReferenceWithFlux: vi.fn(async () => ({
    bytes: Buffer.from('gallery'),
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    revisedPrompt: null,
    provider: 'flux',
    model: 'fal-ai/flux-kontext/dev',
    endpoint: '/fal-ai/flux-kontext/dev',
    requestId: null,
    jobId: null,
    temporaryUrl: null,
  })),
}));

vi.mock('@/lib/virtual-girlfriend/image-modelslab', () => ({
  generateChatImageFromReferenceWithModelsLab: vi.fn(),
  generateChatImageWithModelsLabFaceGen: vi.fn(),
}));

import {
  generateGalleryImageFromReference,
  generatePortraitPreviewImage,
} from '@/lib/virtual-girlfriend/image-provider';
import {
  generateGalleryImageFromReferenceWithFlux,
  generatePortraitPreviewImageWithFlux,
} from '@/lib/virtual-girlfriend/image-flux';

describe('image-provider fal-only routing', () => {
  const priorFluxKey = process.env.FLUX_API_KEY;
  const priorTogetherKey = process.env.TOGETHER_API_KEY;

  afterEach(() => {
    if (priorFluxKey === undefined) delete process.env.FLUX_API_KEY;
    else process.env.FLUX_API_KEY = priorFluxKey;
    if (priorTogetherKey === undefined) delete process.env.TOGETHER_API_KEY;
    else process.env.TOGETHER_API_KEY = priorTogetherKey;
    vi.clearAllMocks();
  });

  it('uses fal flux/dev for portrait previews', async () => {
    process.env.FLUX_API_KEY = 'test-key';
    process.env.TOGETHER_API_KEY = 'together-key';

    await generatePortraitPreviewImage('test prompt', 10101);
    expect(generatePortraitPreviewImageWithFlux).toHaveBeenCalledWith('test prompt', 10101);
  });

  it('uses fal flux-kontext/dev for gallery', async () => {
    process.env.FLUX_API_KEY = 'test-key';
    process.env.TOGETHER_API_KEY = 'together-key';

    await generateGalleryImageFromReference({
      prompt: 'gallery prompt',
      referenceImageBytes: Buffer.from('ref'),
      referenceMimeType: 'image/jpeg',
      referenceImageUrl: 'https://cdn.example.com/canonical.jpg',
    });

    expect(generateGalleryImageFromReferenceWithFlux).toHaveBeenCalledWith({
      prompt: 'gallery prompt',
      referenceImageBytes: Buffer.from('ref'),
      referenceMimeType: 'image/jpeg',
      referenceImageUrl: 'https://cdn.example.com/canonical.jpg',
    });
  });

  it('does not fall back when fal portrait fails', async () => {
    process.env.FLUX_API_KEY = 'test-key';

    vi.mocked(generatePortraitPreviewImageWithFlux).mockRejectedValueOnce(
      new Error('Flux portrait preview generation failed: Rate limit exceeded'),
    );

    await expect(generatePortraitPreviewImage('test prompt')).rejects.toThrow(/Rate limit exceeded/);
    expect(generatePortraitPreviewImageWithFlux).toHaveBeenCalledTimes(1);
  });
});