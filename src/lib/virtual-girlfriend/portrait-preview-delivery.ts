import crypto from 'node:crypto';
import {
  buildPortraitPreviewStorageKey,
  publishBrowserImage,
} from '@/lib/storage/publish-browser-image';
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

export const isReachablePortraitPreviewUrl = async (url: string) => {
  const trimmed = url.trim();
  if (!isHostedUrl(trimmed)) return false;

  try {
    const response = await fetch(trimmed, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      cache: 'no-store',
    });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
};

export const filterReachablePortraitPreviewCandidates = async (
  candidates: VirtualGirlfriendPortraitPreviewCandidate[],
) => {
  const checks = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      ok: await isReachablePortraitPreviewUrl(candidate.imageDataUrl),
    })),
  );
  return checks.filter((entry) => entry.ok).map((entry) => entry.candidate);
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
        const storageKey = buildPortraitPreviewStorageKey({
          userId,
          sessionId,
          index,
          mimeType: parsed.mimeType,
        });
        const published = await publishBrowserImage({
          bytes: parsed.bytes,
          mimeType: parsed.mimeType,
          storageKey,
          cloudinaryFolderPath: `portrait-previews/${userId}`,
          cloudinaryPublicId: `${sessionId}-${index + 1}`,
        });
        if (!published?.deliveryUrl || !isHostedUrl(published.deliveryUrl)) return candidate;
        return { ...candidate, imageDataUrl: published.deliveryUrl };
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