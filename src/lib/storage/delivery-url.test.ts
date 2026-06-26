import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/storage/r2', () => ({
  isR2PublicDeliveryConfigured: vi.fn(() => true),
  buildR2PublicUrl: vi.fn((key: string) => `https://pub-test.r2.dev/${key.replace(/^\//, '')}`),
}));

import { isBrokenR2DeliveryUrl, repairCompanionImageDeliveryUrl } from '@/lib/storage/delivery-url';

describe('companion image delivery URL repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects private cloudflarestorage URLs', () => {
    expect(
      isBrokenR2DeliveryUrl(
        'https://eb7323c66f0bc477975a97b2907ab1cf.r2.cloudflarestorage.com/adultbadies-vg-images/virtual-girlfriend-images/u1/c1/vg.png',
      ),
    ).toBe(true);
  });

  it('rebuilds from origin_storage_key for R2-backed images', () => {
    const repaired = repairCompanionImageDeliveryUrl({
      delivery_url:
        'https://eb7323c66f0bc477975a97b2907ab1cf.r2.cloudflarestorage.com/adultbadies-vg-images/virtual-girlfriend-images/u/c/gallery-1.png',
      delivery_provider: 'cloudflare_r2',
      origin_storage_provider: 'cloudflare_r2',
      origin_storage_key: 'virtual-girlfriend-images/u/c/gallery-1.png',
    });

    expect(repaired).toBe('https://pub-test.r2.dev/virtual-girlfriend-images/u/c/gallery-1.png');
  });

  it('parses object key from broken URL when origin key is missing', () => {
    const repaired = repairCompanionImageDeliveryUrl({
      delivery_url:
        'https://account.r2.cloudflarestorage.com/adultbadies-vg-images/virtual-girlfriend-images/u/c/canonical-0.png',
      delivery_provider: 'cloudflare_r2',
      origin_storage_provider: 'cloudflare_r2',
      origin_storage_key: null,
    });

    expect(repaired).toBe('https://pub-test.r2.dev/virtual-girlfriend-images/u/c/canonical-0.png');
  });

  it('leaves Cloudinary URLs unchanged', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/folder/id.png';
    expect(
      repairCompanionImageDeliveryUrl({
        delivery_url: url,
        delivery_provider: 'cloudinary',
        origin_storage_provider: 'cloudinary',
        origin_storage_key: 'folder/id',
      }),
    ).toBe(url);
  });
});