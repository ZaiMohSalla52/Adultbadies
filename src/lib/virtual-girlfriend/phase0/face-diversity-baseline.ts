import {
  buildImageFingerprint,
  compareFingerprints,
  PHASE0_FACE_SIMILARITY_THRESHOLD,
  type ImageFingerprint,
} from '@/lib/virtual-girlfriend/phase0/image-fingerprint';

export type CanonicalCompanionRow = {
  userId: string;
  companionId: string;
  companionName: string;
  origin: string | null;
  age: string | number | null;
  canonicalImageId: string;
  deliveryUrl: string;
  mimeType: string | null;
};

export type CompanionFingerprintRow = CanonicalCompanionRow & {
  fingerprint: ImageFingerprint;
  bytes: number;
};

export type PairwiseSimilarity = {
  userId: string;
  leftCompanionId: string;
  rightCompanionId: string;
  leftName: string;
  rightName: string;
  cosine: number;
  dHashSimilarity: number;
  nearDuplicate: boolean;
};

export const buildPairwiseSimilarities = (rows: CompanionFingerprintRow[]): PairwiseSimilarity[] => {
  const byUser = new Map<string, CompanionFingerprintRow[]>();
  for (const row of rows) {
    const bucket = byUser.get(row.userId) ?? [];
    bucket.push(row);
    byUser.set(row.userId, bucket);
  }

  const pairs: PairwiseSimilarity[] = [];
  for (const [userId, companions] of byUser) {
    if (companions.length < 2) continue;
    for (let i = 0; i < companions.length; i += 1) {
      for (let j = i + 1; j < companions.length; j += 1) {
        const left = companions[i]!;
        const right = companions[j]!;
        const comparison = compareFingerprints(left.fingerprint, right.fingerprint);
        pairs.push({
          userId,
          leftCompanionId: left.companionId,
          rightCompanionId: right.companionId,
          leftName: left.companionName,
          rightName: right.companionName,
          cosine: Number(comparison.cosine.toFixed(4)),
          dHashSimilarity: Number(comparison.dHashSimilarity.toFixed(4)),
          nearDuplicate: comparison.nearDuplicate,
        });
      }
    }
  }

  return pairs.sort((a, b) => b.cosine - a.cosine);
};

export const summarizeFaceDiversity = (pairs: PairwiseSimilarity[]) => {
  const nearDuplicatePairs = pairs.filter((pair) => pair.nearDuplicate);
  const highCosinePairs = pairs.filter((pair) => pair.cosine >= PHASE0_FACE_SIMILARITY_THRESHOLD);
  const usersWithPairs = new Set(pairs.map((pair) => pair.userId));

  return {
    pairCount: pairs.length,
    usersWithMultipleCompanions: usersWithPairs.size,
    nearDuplicatePairs: nearDuplicatePairs.length,
    highCosinePairs: highCosinePairs.length,
    pctNearDuplicate: pairs.length ? Number(((nearDuplicatePairs.length / pairs.length) * 100).toFixed(1)) : 0,
    pctHighCosine: pairs.length ? Number(((highCosinePairs.length / pairs.length) * 100).toFixed(1)) : 0,
    threshold: PHASE0_FACE_SIMILARITY_THRESHOLD,
    topPairs: pairs.slice(0, 10),
    gateRecommendation:
      pairs.length && nearDuplicatePairs.length / pairs.length >= 0.3
        ? 'P0 face diversity fix is warranted — >30% sibling pairs are near-duplicates.'
        : pairs.length
          ? 'Review top pairs visually; automated gate may be optional.'
          : 'Insufficient multi-companion users — collect more setup data before Phase 1.',
  };
};

export const fingerprintFromBytes = (row: CanonicalCompanionRow, bytes: Buffer): CompanionFingerprintRow => ({
  ...row,
  bytes: bytes.byteLength,
  fingerprint: buildImageFingerprint(bytes, row.mimeType),
});