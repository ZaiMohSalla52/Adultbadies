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

  it('prefers R2 public when configured', async () => {
    vi.mocked(isCloudinaryConfigured).mockReturnValue(true);
    vi.mocked(isR2PublicDeliveryConfigured).mockReturnValue(true);
    vi.mocked(uploadToR2).mockResolvedValue({
      provider: 'cloudflare_r2',
      key: 'portrait-previews/u1/s1-1.png',
      bucket: 'bucket',
    });

    const result = await publishBrowserImage({
      bytes: Buffer.from('png-bytes'),
      mimeType: 'image/png',
      storageKey: 'portrait-previews/u1/s1-1.png',
      cloudinaryFolderPath: 'portrait-previews/u1',
      cloudinaryPublicId: 's1-1',
    });

    expect(result?.provider).toBe('cloudflare_r2');
    expect(result?.deliveryUrl).toContain('r2.example');
    expect(uploadToR2).toHaveBeenCalledTimes(1);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('falls back to Cloudinary when R2 fails', async () => {
    vi.mocked(isCloudinaryConfigured).mockReturnValue(true);
    vi.mocked(isR2PublicDeliveryConfigured).mockReturnValue(true);
    vi.mocked(uploadToR2).mockRejectedValue(new Error('r2 down'));
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
    });

    expect(result?.provider).toBe('cloudinary');
    expect(uploadToR2).toHaveBeenCalledTimes(1);
    expect(uploadToCloudinary).toHaveBeenCalledTimes(1);
  });

  it('returns null when only ModelsLab would have been available', async () => {
    const result = await publishBrowserImage({
      bytes: Buffer.from('png-bytes'),
      mimeType: 'image/png',
      storageKey: 'portrait-previews/u1/s1-1.png',
    });

    expect(result).toBeNull();
  });
});