import { isCloudinaryConfigured, uploadToCloudinary } from '@/lib/storage/cloudinary';
import {
  buildR2PublicUrl,
  isR2PublicDeliveryConfigured,
  isR2UploadConfigured,
  uploadToR2,
} from '@/lib/storage/r2';
export type BrowserImageDelivery = {
  deliveryUrl: string;
  provider: string;
  publicId: string;
  width?: number | null;
  height?: number | null;
};

const extensionFromMimeType = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  return 'png';
};

/**
 * Upload bytes and return a browser-loadable HTTPS URL.
 * R2 public first (source-of-truth bucket), then Cloudinary.
 * Portrait/gallery/setup never use ModelsLab hosting — configure R2 or Cloudinary.
 */
export const publishBrowserImage = async (input: {
  bytes: Buffer;
  mimeType: string;
  storageKey: string;
  cloudinaryFolderPath?: string;
  cloudinaryPublicId?: string;
}): Promise<BrowserImageDelivery | null> => {
  if (isR2PublicDeliveryConfigured()) {
    try {
      await uploadToR2({
        key: input.storageKey,
        body: input.bytes,
        contentType: input.mimeType,
      });
      return {
        deliveryUrl: buildR2PublicUrl(input.storageKey),
        provider: 'cloudflare_r2',
        publicId: input.storageKey,
      };
    } catch (error) {
      console.warn('[publish-browser-image] R2 public delivery upload failed; trying Cloudinary fallback', {
        storageKey: input.storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (isCloudinaryConfigured()) {
    try {
      const uploaded = await uploadToCloudinary({
        bytes: input.bytes,
        mimeType: input.mimeType,
        folderPath: input.cloudinaryFolderPath ?? 'uploads',
        publicId: input.cloudinaryPublicId ?? `img-${Date.now()}`,
      });
      return {
        deliveryUrl: uploaded.deliveryUrl,
        provider: uploaded.provider,
        publicId: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
      };
    } catch (error) {
      console.warn('[publish-browser-image] Cloudinary upload failed', {
        storageKey: input.storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
};

/** Best-effort R2 archive upload (source-of-truth original). Does not block browser delivery. */
export const archiveBrowserImageToR2 = async (input: {
  bytes: Buffer;
  mimeType: string;
  storageKey: string;
}) => {
  if (!isR2UploadConfigured()) return null;

  try {
    return await uploadToR2({
      key: input.storageKey,
      body: input.bytes,
      contentType: input.mimeType,
    });
  } catch (error) {
    console.warn('[publish-browser-image] optional R2 archive failed', {
      storageKey: input.storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const buildPortraitPreviewStorageKey = (input: {
  userId: string;
  sessionId: string;
  index: number;
  mimeType: string;
}) => {
  const ext = extensionFromMimeType(input.mimeType);
  return `portrait-previews/${input.userId}/${input.sessionId}-${input.index + 1}.${ext}`;
};

export const isBrowserImageDeliveryConfigured = () =>
  isCloudinaryConfigured() || isR2PublicDeliveryConfigured();