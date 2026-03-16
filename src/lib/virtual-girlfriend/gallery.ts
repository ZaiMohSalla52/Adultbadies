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

const compareImageQuality = (a: VirtualGirlfriendCompanionImageRecord, b: VirtualGirlfriendCompanionImageRecord) => {
  const qualityDelta = (b.quality_score ?? 0) - (a.quality_score ?? 0);
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

export const curateVirtualGirlfriendImages = (images: VirtualGirlfriendCompanionImageRecord[]) => {
  const sorted = [...images].sort(compareImageQuality);
  const deduped = uniqueByDistinctness(sorted);

  const canonical = deduped.find((image) => image.image_kind === 'canonical') ?? deduped[0] ?? null;
  const galleryCandidates = deduped.filter((image) => !canonical || image.id !== canonical.id);
  const limit = canonical ? VIRTUAL_GIRLFRIEND_MAX_IMAGES - 1 : VIRTUAL_GIRLFRIEND_MAX_IMAGES;
  const gallery = galleryCandidates.slice(0, Math.max(limit, 0));

  return {
    canonical,
    gallery,
    images: canonical ? [canonical, ...gallery] : gallery,
  };
};
