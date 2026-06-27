import {
  buildImageFingerprint,
  compareFingerprints,
  type ImageFingerprint,
} from '@/lib/virtual-girlfriend/phase0/image-fingerprint';

export type SiblingCanonicalReference = {
  companionId: string;
  deliveryUrl: string;
  mimeType: string | null;
};

/** Keep low — each retry is a full ModelsLab portrait round-trip. */
export const PORTRAIT_DISTINCTNESS_MAX_RETRIES = 2;

const parseDataUrlImage = (dataUrl: string): { bytes: Buffer; mimeType: string } | null => {
  const matched = dataUrl.trim().match(/^data:(.+?);base64,(.+)$/);
  if (!matched) return null;
  try {
    return { mimeType: matched[1] ?? 'image/png', bytes: Buffer.from(matched[2] ?? '', 'base64') };
  } catch {
    return null;
  }
};

const downloadReferenceBytes = async (url: string): Promise<{ bytes: Buffer; mimeType: string }> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Sibling canonical download failed (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  if (!bytes.byteLength) {
    throw new Error('Sibling canonical bytes were empty.');
  }
  return {
    bytes,
    mimeType: response.headers.get('content-type') ?? 'image/png',
  };
};

export const fingerprintPortraitPreviewBytes = (
  bytes: Buffer,
  mimeType: string,
): ImageFingerprint => buildImageFingerprint(bytes, mimeType);

export const fingerprintPortraitPreviewDataUrl = (dataUrl: string): ImageFingerprint | null => {
  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) return null;
  return fingerprintPortraitPreviewBytes(parsed.bytes, parsed.mimeType);
};

export const maxFingerprintSimilarity = (
  candidate: ImageFingerprint,
  references: ImageFingerprint[],
) => {
  if (!references.length) return 0;
  return references.reduce((max, reference) => {
    const comparison = compareFingerprints(candidate, reference);
    return Math.max(max, comparison.cosine, comparison.dHashSimilarity);
  }, 0);
};

export const isNearDuplicatePortraitFingerprint = (
  candidate: ImageFingerprint,
  references: ImageFingerprint[],
) => references.some((reference) => compareFingerprints(candidate, reference).nearDuplicate);

export const loadSiblingCanonicalFingerprints = async (
  references: SiblingCanonicalReference[],
): Promise<ImageFingerprint[]> => {
  const fingerprints: ImageFingerprint[] = [];

  for (const reference of references) {
    if (!reference.deliveryUrl.trim()) continue;
    try {
      const downloaded = await downloadReferenceBytes(reference.deliveryUrl.trim());
      fingerprints.push(fingerprintPortraitPreviewBytes(downloaded.bytes, downloaded.mimeType));
    } catch (error) {
      console.warn('[virtual-girlfriend][portrait-distinctness] sibling fingerprint skipped', {
        companionId: reference.companionId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return fingerprints;
};