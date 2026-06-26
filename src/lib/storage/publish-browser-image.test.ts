import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/storage/cloudinary', () => ({
  isCloudinaryConfigured: vi.fn(),
  uploadToCloudinary: vi.fn(),
}));

vi.mock('@/lib/storage/r2', () => ({
  isR2PublicDeliveryConfigured: vi.fn(),
  isR2UploadConfigured: vi.fn(),
  buildR2PublicUrl: vi.fn((key: string) => `https://r2.example/${key}`),
  uploadToR2: vi.fn(),
}));

vi.mock('@/lib/virtual-girlfriend/modelslab-client', () => ({
  uploadReferenceImageUrl: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { MODELSLAB_API_KEY: undefined },
}));

import { isCloudinaryConfigured, uploadToCloudinary } from '@/lib/storage/cloudinary';
import { isR2PublicDeliveryConfigured, uploadToR2 } from '@/lib/storage/r2';
import { publishBrowserImage } from '@/lib/storage/publish-browser-image';

describe('publishBrowserImage delivery priority', () => {
  beforeEach(() => {
    vi.mocked(isCloudinaryConfigured).mockReturnValue(false);
    vi.mocked(isR2PublicDeliveryConfigured).mockReturnValue(false);
    vi.mocked(uploadToCloudinary).mockReset();
    vi.mocked(uploadToR2).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prefers Cloudinary when configured', async () => {
    vi.mocked(isCloudinaryConfigured).mockReturnValue(true);
    vi.mocked(isR2PublicDeliveryConfigured).mockReturnValue(true);
    vi.mocked(uploadToCloudinary).mockResolvedValue({
      provider: 'cloudinary',
      deliveryUrl: 'https://res.cloudinary.com/demo/image/upload/v1/portrait.png',
      publicId: 'folder/portrait',
      width: 768,
      height: 1024,
    });

    const result = await publishBrowserImage({
      bytes: Buffer.from('png-bytes'),
      mimeType: 'image/png',
      storageKey: 'portrait-previews/u1/s1-1.png',
      cloudinaryFolderPath: 'portrait-previews/u1',
      cloudinaryPublicId: 's1-1',
    });

    expect(result?.provider).toBe('cloudinary');
    expect(result?.deliveryUrl).toContain('cloudinary.com');
    expect(uploadToCloudinary).toHaveBeenCalledTimes(1);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('falls back to R2 when Cloudinary fails', async () => {
    vi.mocked(isCloudinaryConfigured).mockReturnValue(true);
    vi.mocked(isR2PublicDeliveryConfigured).mockReturnValue(true);
    vi.mocked(uploadToCloudinary).mockRejectedValue(new Error('cloudinary down'));
    vi.mocked(uploadToR2).mockResolvedValue({
      provider: 'cloudflare_r2',
      key: 'portrait-previews/u1/s1-1.png',
      bucket: 'bucket',
    });

    const result = await publishBrowserImage({
      bytes: Buffer.from('png-bytes'),
      mimeType: 'image/png',
      storageKey: 'portrait-previews/u1/s1-1.png',
    });

    expect(result?.provider).toBe('cloudflare_r2');
    expect(uploadToCloudinary).toHaveBeenCalledTimes(1);
    expect(uploadToR2).toHaveBeenCalledTimes(1);
  });
});