import crypto from 'node:crypto';
import {
  buildPortraitPreviewStorageKey,
  publishBrowserImage,
} from '@/lib/storage/publish-browser-image';
import type { VirtualGirlfriendPortraitPreviewCandidate } from '@/lib/virtual-girlfriend/image-machine';
import { isUsablePortraitImageBytes } from '@/lib/virtual-girlfriend/image-luminance';

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

const downloadPortraitPreviewBytes = async (url: string) => {
  const response = await fetch(url.trim(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Portrait preview download failed (${response.status}).`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.byteLength) {
    throw new Error('Portrait preview download returned empty bytes.');
  }
  return {
    bytes,
    mimeType: response.headers.get('content-type') ?? 'image/png',
  };
};

export const isReachablePortraitPreviewUrl = async (url: string) => {
  const trimmed = url.trim();
  if (!isHostedUrl(trimmed)) return false;

  try {
    const rangeResponse = await fetch(trimmed, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      cache: 'no-store',
    });
    if (rangeResponse.ok || rangeResponse.status === 206) return true;

    // Some storage/CDN fronts reject Range but still serve the object.
    const headResponse = await fetch(trimmed, { method: 'HEAD', cache: 'no-store' });
    return headResponse.ok;
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
      // ModelsLab already returns browser-loadable HTTPS URLs — skip download/re-upload round trip.
      if (isHostedUrl(candidate.imageDataUrl)) {
        return candidate;
      }

      const parsed = parseDataUrlImage(candidate.imageDataUrl);
      let bytes: Buffer | null = parsed?.bytes ?? null;
      let mimeType = parsed?.mimeType ?? 'image/png';

      if (!bytes && isHostedUrl(candidate.imageDataUrl)) {
        try {
          const downloaded = await downloadPortraitPreviewBytes(candidate.imageDataUrl);
          bytes = downloaded.bytes;
          mimeType = downloaded.mimeType;
        } catch (error) {
          console.warn('[portrait-preview] provider URL download failed', {
            userId,
            candidateId: candidate.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return candidate;
        }
      }

      if (!bytes) return candidate;

      if (!isUsablePortraitImageBytes(bytes)) {
        console.warn('[portrait-preview] blank portrait bytes detected; keeping provider candidate', {
          userId,
          candidateId: candidate.id,
        });
        return isHostedUrl(candidate.imageDataUrl) ? candidate : null;
      }

      try {
        const storageKey = buildPortraitPreviewStorageKey({
          userId,
          sessionId,
          index,
          mimeType,
        });
        const published = await publishBrowserImage({
          bytes,
          mimeType,
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
        if (parsed) return candidate;
        return { ...candidate, imageDataUrl: `data:${mimeType};base64,${bytes.toString('base64')}` };
      }
    }),
  ).then((results) => results.filter((candidate): candidate is VirtualGirlfriendPortraitPreviewCandidate => candidate !== null));
};