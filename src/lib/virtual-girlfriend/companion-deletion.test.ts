import { describe, expect, it } from 'vitest';
import { collectCompanionStorageTargets } from '@/lib/virtual-girlfriend/companion-deletion';
import type { VirtualGirlfriendCompanionImageRecord } from '@/lib/virtual-girlfriend/types';

const baseImage = (overrides: Partial<VirtualGirlfriendCompanionImageRecord>): VirtualGirlfriendCompanionImageRecord => ({
  id: 'img-1',
  user_id: 'user-1',
  companion_id: 'comp-1',
  visual_profile_id: 'vp-1',
  image_kind: 'gallery',
  variant_index: 1,
  origin_storage_provider: 'cloudflare_r2',
  origin_storage_key: 'user/comp/original.png',
  origin_mime_type: 'image/png',
  origin_byte_size: 1000,
  delivery_provider: 'cloudinary',
  delivery_public_id: 'folder/public-id',
  delivery_url: 'https://res.cloudinary.com/demo/image/upload/v1/folder/public-id.png',
  width: 768,
  height: 1024,
  prompt_hash: 'hash',
  style_version: 'vg-image-v3',
  seed_metadata: {},
  lineage_metadata: {},
  moderation_status: 'pending',
  moderation: {},
  provenance: {},
  quality_score: null,
  prompt_text: null,
  prompt_version: null,
  surface_type: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('collectCompanionStorageTargets', () => {
  it('deduplicates R2 keys and collects Cloudinary public ids', () => {
    const targets = collectCompanionStorageTargets([
      baseImage({ id: 'a', origin_storage_key: 'k1.png', delivery_public_id: 'p1' }),
      baseImage({ id: 'b', origin_storage_key: 'k1.png', delivery_public_id: 'p2' }),
      baseImage({
        id: 'c',
        origin_storage_provider: 'other',
        origin_storage_key: '',
        delivery_provider: 'other',
        delivery_public_id: null,
      }),
    ]);

    expect(targets.r2Keys).toEqual(['k1.png']);
    expect(targets.cloudinaryIds).toEqual(['p1', 'p2']);
  });
});