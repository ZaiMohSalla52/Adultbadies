import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendCompanionStatus,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';
import { curateVirtualGirlfriendImages } from '@/lib/virtual-girlfriend/gallery';

export const resolveCompanionImageState = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  images: VirtualGirlfriendCompanionImageRecord[];
  visualProfile: VirtualGirlfriendVisualProfileRecord | null;
}): VirtualGirlfriendCompanionStatus => {
  const explicitStatus = input.companion.generation_status;
  const curated = curateVirtualGirlfriendImages(input.images, {
    lockedCanonicalImageId: input.visualProfile?.canonical_reference_image_id ?? null,
  });

  const hasCanonical = Boolean(curated.canonical);
  const hasGallery = curated.gallery.length > 0;

  if (explicitStatus === 'generating') {
    return hasCanonical ? 'partial_success' : 'generating';
  }

  if (explicitStatus === 'failed') {
    return hasCanonical ? 'partial_success' : 'failed';
  }

  if (input.visualProfile?.canonical_review_status === 'pending' && hasCanonical) {
    // Review gating for user visibility is deferred. Surface pending state without hiding usable images.
    return 'review_pending';
  }

  if (explicitStatus === 'ready') {
    return hasCanonical || hasGallery ? 'ready' : 'failed';
  }

  const ageMs = Date.now() - new Date(input.companion.updated_at).getTime();
  const staleWithoutImages = ageMs > 2 * 60 * 1000;
  if (hasCanonical && !hasGallery) return 'partial_success';
  if (hasCanonical || hasGallery) return 'ready';
  return staleWithoutImages ? 'failed' : 'generating';
};
