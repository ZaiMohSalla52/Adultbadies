import { describe, expect, it } from 'vitest';
import {
  buildImageFingerprint,
  compareFingerprints,
} from '@/lib/virtual-girlfriend/phase0/image-fingerprint';
import {
  isNearDuplicatePortraitFingerprint,
  maxFingerprintSimilarity,
} from '@/lib/virtual-girlfriend/portrait-distinctness-gate';

const solidPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('portrait-distinctness-gate', () => {
  it('flags identical fingerprints as near duplicates', () => {
    const fingerprint = buildImageFingerprint(solidPng, 'image/png');
    expect(isNearDuplicatePortraitFingerprint(fingerprint, [fingerprint])).toBe(true);
  });

  it('treats orthogonal vectors as distinct', () => {
    const left = buildImageFingerprint(solidPng, 'image/png');
    const rightVector = new Float32Array(left.vector.length);
    rightVector[1] = 1;
    const rightFingerprint = { vector: rightVector, dHash: left.dHash ^ 0xffff_ffff_ffff_ffffn };
    expect(isNearDuplicatePortraitFingerprint(left, [rightFingerprint])).toBe(false);
    expect(maxFingerprintSimilarity(left, [rightFingerprint])).toBeLessThan(0.85);
    expect(compareFingerprints(left, rightFingerprint).nearDuplicate).toBe(false);
  });
});