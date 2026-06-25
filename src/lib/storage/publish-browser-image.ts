import { env } from '@/lib/env';
import { isCloudinaryConfigured, uploadToCloudinary } from '@/lib/storage/cloudinary';
import {
  buildR2PublicUrl,
  isR2PublicDeliveryConfigured,
  uploadToR2,
} from '@/lib/storage/r2';
import { uploadReferenceImageUrl } from '@/lib/virtual-girlfriend/modelslab-client';

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

/** Upload bytes and return a browser-loadable HTTPS URL. Prefers R2 public delivery. */
export const publishBrowserImage = async (input: {
  bytes: Buffer;
  mimeType: string;
  storageKey: string;
  cloudinaryFolderPath?: string;
  cloudinaryPublicId?: string;
}): Promise<BrowserImageDelivery | null> => {
  if (isR2PublicDeliveryConfigured()) {
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
  }

  if (isCloudinaryConfigured()) {
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
  }

  if (env.MODELSLAB_API_KEY?.trim()) {
    const deliveryUrl = await uploadReferenceImageUrl(input.bytes, input.mimeType);
    return {
      deliveryUrl,
      provider: 'modelslab',
      publicId: input.storageKey,
    };
  }

  return null;
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
  isR2PublicDeliveryConfigured() || isCloudinaryConfigured() || Boolean(env.MODELSLAB_API_KEY?.trim());