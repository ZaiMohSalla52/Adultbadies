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

/** Each retry is a full portrait round-trip — 4 retries catches Flux clone clusters. */
export const PORTRAIT_DISTINCTNESS_MAX_RETRIES = 4;

export const CANONICAL_DISTINCTNESS_MAX_RETRIES = 4;

const CANONICAL_RETRY_SCENES = [
  'OUTDOOR rainy campus quad with umbrella — no library interior, no bookshelves.',
  'OUTDOOR sunlit rooftop garden — no indoor study, no knit cardigan portrait.',
  'OUTDOOR night-market neon street — no beige sweater, no library.',
] as const;

const CANONICAL_CLONE_BAN_CUES = [
  'beige or cream ribbed sweater or cardigan',
  'library bookshelves background',
  'indoor study aesthetic with coffee cup',
  'long black wavy hair with soft smile',
] as const;

export const buildCanonicalDistinctnessRetryPrompt = (basePrompt: string, attempt: number) => {
  const scene = CANONICAL_RETRY_SCENES[attempt % CANONICAL_RETRY_SCENES.length];
  return [
    basePrompt,
    'CRITICAL DISTINCTNESS: This portrait must look like a completely different person from every existing companion.',
    `Force new scene: ${scene}`,
    `Do NOT use: ${CANONICAL_CLONE_BAN_CUES.join('; ')}.`,
    'Change face shape, hairstyle, outfit color, and background dramatically.',
  ].join(' ');
};

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