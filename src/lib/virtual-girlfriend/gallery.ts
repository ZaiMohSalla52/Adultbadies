import type { VirtualGirlfriendCompanionImageRecord } from '@/lib/virtual-girlfriend/types';

export const VIRTUAL_GIRLFRIEND_MAX_IMAGES = 3;

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildDistinctnessKey = (image: VirtualGirlfriendCompanionImageRecord) => {
  const metadata = image.lineage_metadata ?? {};
  const captureLabel = normalizeText(metadata.captureLabel);
  const captureMood = normalizeText(metadata.captureMood);
  const captureEnvironment = normalizeText(metadata.captureEnvironment);
  const basePromptHash = image.prompt_hash.slice(0, 24);
  return `${image.image_kind}|${image.variant_index}|${captureLabel}|${captureMood}|${captureEnvironment}|${basePromptHash}`;
};

const buildDiversitySignature = (image: VirtualGirlfriendCompanionImageRecord) => {
  const metadata = image.lineage_metadata ?? {};
  const parts = [
    normalizeText(metadata.captureLabel),
    normalizeText(metadata.captureMood),
    normalizeText(metadata.captureEnvironment),
    normalizeText(metadata.revisedPrompt).slice(0, 220),
  ].filter(Boolean);

  return parts.join(' ').trim();
};

const tokenSet = (value: string) =>
  new Set(
    value
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4),
  );

const jaccardSimilarity = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
};

const deriveImageScore = (image: VirtualGirlfriendCompanionImageRecord) => {
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  const pixelScore = width > 0 && height > 0 ? Math.min((width * height) / (1024 * 1024), 2) : 0;
  const qualityBase = image.quality_score ?? 0;
  const mode = String(image.lineage_metadata?.generation_mode ?? '').toLowerCase();
  const isCanonicalDerived = mode.includes('canonical');
  const styleBonus = image.image_kind === 'gallery' ? 0.12 : image.image_kind === 'canonical' ? 0.2 : 0;
  const continuityBonus = isCanonicalDerived ? 0.06 : 0;

  return qualityBase + pixelScore * 0.08 + styleBonus + continuityBonus;
};

const compareImageQuality = (a: VirtualGirlfriendCompanionImageRecord, b: VirtualGirlfriendCompanionImageRecord) => {
  const qualityDelta = deriveImageScore(b) - deriveImageScore(a);
  if (qualityDelta !== 0) {
    return qualityDelta;
  }

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
};

const uniqueByDistinctness = (images: VirtualGirlfriendCompanionImageRecord[]) => {
  const seen = new Set<string>();
  const unique: VirtualGirlfriendCompanionImageRecord[] = [];

  for (const image of images) {
    const key = buildDistinctnessKey(image);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(image);
  }

  return unique;
};

const selectDiverseGallery = (
  images: VirtualGirlfriendCompanionImageRecord[],
  limit: number,
): VirtualGirlfriendCompanionImageRecord[] => {
  const picked: VirtualGirlfriendCompanionImageRecord[] = [];
  const pickedSignatures: Array<Set<string>> = [];

  for (const image of images) {
    if (picked.length >= limit) break;

    const signatureTokens = tokenSet(buildDiversitySignature(image));
    const isTooSimilar = pickedSignatures.some((existing) => jaccardSimilarity(existing, signatureTokens) >= 0.72);

    if (isTooSimilar) {
      continue;
    }

    picked.push(image);
    pickedSignatures.push(signatureTokens);
  }

  if (picked.length < limit) {
    for (const image of images) {
      if (picked.length >= limit) break;
      if (picked.some((entry) => entry.id === image.id)) continue;
      picked.push(image);
    }
  }

  return picked;
};

export const curateVirtualGirlfriendImages = (
  images: VirtualGirlfriendCompanionImageRecord[],
  options?: { lockedCanonicalImageId?: string | null },
) => {
  const sorted = [...images].sort(compareImageQuality);
  const deduped = uniqueByDistinctness(sorted);

  const canonical =
    (options?.lockedCanonicalImageId
      ? deduped.find((image) => image.id === options.lockedCanonicalImageId)
      : null)
    ?? deduped.find((image) => image.image_kind === 'canonical')
    ?? deduped[0]
    ?? null;
  const galleryCandidates = deduped.filter((image) => !canonical || image.id !== canonical.id);
  const limit = canonical ? VIRTUAL_GIRLFRIEND_MAX_IMAGES - 1 : VIRTUAL_GIRLFRIEND_MAX_IMAGES;
  const gallery = selectDiverseGallery(galleryCandidates, Math.max(limit, 0));

  return {
    canonical,
    gallery,
    images: canonical ? [canonical, ...gallery] : gallery,
  };
};
