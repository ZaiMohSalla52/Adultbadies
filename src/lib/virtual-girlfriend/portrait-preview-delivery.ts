import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { uploadToCloudinary } from '@/lib/storage/cloudinary';
import { uploadReferenceImageUrl } from '@/lib/virtual-girlfriend/modelslab-client';
import type { VirtualGirlfriendPortraitPreviewCandidate } from '@/lib/virtual-girlfriend/image-machine';

const parseDataUrlImage = (dataUrl: string): { bytes: Buffer; mimeType: string } | null => {
  const matched = dataUrl.trim().match(/^data:(.+?);base64,(.+)$/);
  if (!matched) return null;
  try {
    return { mimeType: matched[1] ?? 'image/png', bytes: Buffer.from(matched[2] ?? '', 'base64') };
  } catch {
    return null;
  }
};

const isHostedUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const publishPreviewImage = async (input: {
  bytes: Buffer;
  mimeType: string;
  userId: string;
  sessionId: string;
  index: number;
}) => {
  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    const uploaded = await uploadToCloudinary({
      bytes: input.bytes,
      mimeType: input.mimeType,
      folderPath: `portrait-previews/${input.userId}`,
      publicId: `${input.sessionId}-${input.index + 1}`,
    });
    return uploaded.deliveryUrl;
  }

  if (env.MODELSLAB_API_KEY?.trim()) {
    return uploadReferenceImageUrl(input.bytes, input.mimeType);
  }

  return null;
};

/** Replace heavy base64 previews with short-lived hosted URLs for API responses. */
export const deliverPortraitPreviewCandidates = async (
  candidates: VirtualGirlfriendPortraitPreviewCandidate[],
  userId: string,
): Promise<VirtualGirlfriendPortraitPreviewCandidate[]> => {
  const sessionId = crypto.randomUUID();

  return Promise.all(
    candidates.map(async (candidate, index) => {
      if (isHostedUrl(candidate.imageDataUrl)) return candidate;

      const parsed = parseDataUrlImage(candidate.imageDataUrl);
      if (!parsed) return candidate;

      try {
        const deliveryUrl = await publishPreviewImage({
          bytes: parsed.bytes,
          mimeType: parsed.mimeType,
          userId,
          sessionId,
          index,
        });
        if (!deliveryUrl) return candidate;
        return { ...candidate, imageDataUrl: deliveryUrl };
      } catch (error) {
        console.warn('[portrait-preview] hosted delivery failed, keeping data URL fallback', {
          userId,
          candidateId: candidate.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return candidate;
      }
    }),
  );
};