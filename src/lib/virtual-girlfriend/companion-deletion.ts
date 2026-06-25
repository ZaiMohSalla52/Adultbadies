import { destroyCloudinaryImage } from '@/lib/storage/cloudinary';
import { deleteFromR2 } from '@/lib/storage/r2';
import type { VirtualGirlfriendCompanionImageRecord } from '@/lib/virtual-girlfriend/types';

export type DeleteCompanionResult = {
  deleted: boolean;
  companion_id: string;
  promoted_companion_id: string | null;
  remaining_count: number;
};

export const collectCompanionStorageTargets = (images: VirtualGirlfriendCompanionImageRecord[]) => {
  const r2Keys = new Set<string>();
  const cloudinaryIds = new Set<string>();

  for (const image of images) {
    if (image.origin_storage_provider === 'cloudflare_r2' && image.origin_storage_key?.trim()) {
      r2Keys.add(image.origin_storage_key.trim());
    }
    if (image.delivery_provider === 'cloudinary' && image.delivery_public_id?.trim()) {
      cloudinaryIds.add(image.delivery_public_id.trim());
    }
  }

  return {
    r2Keys: Array.from(r2Keys),
    cloudinaryIds: Array.from(cloudinaryIds),
  };
};

/** Remove R2 originals and Cloudinary delivery assets for a companion's images. */
export const purgeCompanionImageStorage = async (images: VirtualGirlfriendCompanionImageRecord[]) => {
  const { r2Keys, cloudinaryIds } = collectCompanionStorageTargets(images);

  await Promise.allSettled([
    ...r2Keys.map((key) => deleteFromR2(key)),
    ...cloudinaryIds.map((publicId) => destroyCloudinaryImage(publicId)),
  ]);
};