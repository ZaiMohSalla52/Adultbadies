import { describe, expect, it } from 'vitest';

import { auditThread } from '@/lib/virtual-girlfriend/phase0/chat-thread-audit';
import {
  buildPairwiseSimilarities,
  fingerprintFromBytes,
  summarizeFaceDiversity,
} from '@/lib/virtual-girlfriend/phase0/face-diversity-baseline';
import {
  buildImageFingerprint,
  compareFingerprints,
  cosineSimilarity,
  PHASE0_FACE_SIMILARITY_THRESHOLD,
} from '@/lib/virtual-girlfriend/phase0/image-fingerprint';
import {
  buildTurnTraceIntent,
  summarizeRetrievedMemories,
} from '@/lib/virtual-girlfriend/phase0/turn-trace';

const solidPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('phase0 image fingerprint', () => {
  it('scores identical fingerprints as near-duplicates', () => {
    const fingerprint = buildImageFingerprint(solidPng, 'image/png');
    const comparison = compareFingerprints(fingerprint, fingerprint);
    expect(comparison.cosine).toBeCloseTo(1, 5);
    expect(comparison.nearDuplicate).toBe(true);
  });

  it('scores orthogonal vectors below the phase0 gate', () => {
    const left = buildImageFingerprint(solidPng, 'image/png');
    const rightVector = new Float32Array(left.vector.length);
    rightVector[0] = 1;
    const comparison = compareFingerprints(left, {
      vector: rightVector,
      dHash: left.dHash ^ 0xffff_ffff_ffff_ffffn,
    });
    expect(cosineSimilarity(left.vector, rightVector)).toBeLessThan(PHASE0_FACE_SIMILARITY_THRESHOLD);
    expect(comparison.nearDuplicate).toBe(false);
  });
});

describe('phase0 face diversity baseline', () => {
  it('builds pairwise rows for companions under the same user', () => {
    const base = {
      userId: 'user-1',
      origin: 'asian',
      age: 21,
      canonicalImageId: 'img-1',
      deliveryUrl: 'https://example.com/a.png',
      mimeType: 'image/png',
    };
    const rows = [
      fingerprintFromBytes({ ...base, companionId: 'c1', companionName: 'A' }, solidPng),
      fingerprintFromBytes({ ...base, companionId: 'c2', companionName: 'B' }, solidPng),
      fingerprintFromBytes({ ...base, userId: 'user-2', companionId: 'c3', companionName: 'C' }, solidPng),
    ];

    const pairs = buildPairwiseSimilarities(rows);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.nearDuplicate).toBe(true);

    const summary = summarizeFaceDiversity(pairs);
    expect(summary.pairCount).toBe(1);
    expect(summary.pctNearDuplicate).toBe(100);
  });
});

describe('phase0 chat thread audit', () => {
  it('flags refusal leaks and photo mismatches', () => {
    const audit = auditThread([
      { id: 'u1', role: 'user', content: 'send me a photo of you in that dress' },
      {
        id: 'a1',
        role: 'assistant',
        content: "I can't send real-world photos, but I can offer a written scene.",
      },
    ]);

    expect(audit.byType.refusal_leak).toBe(1);
    expect(audit.byType.photo_mismatch).toBe(1);
    expect(audit.healthScore).toBeLessThan(80);
  });

  it('flags forgetfulness when assistant re-asks known user facts', () => {
    const audit = auditThread([
      { id: 'u1', role: 'user', content: 'I work as a software engineer in Austin.' },
      { id: 'a1', role: 'assistant', content: 'That sounds intense.' },
      { id: 'u2', role: 'user', content: 'Yeah, long week.' },
      { id: 'a2', role: 'assistant', content: 'What do you do for work?' },
    ]);

    expect(audit.byType.forgetfulness).toBe(1);
  });
});

describe('phase0 turn trace helpers', () => {
  it('summarizes retrieved memories and intent fields', () => {
    const memorySummary = summarizeRetrievedMemories([
      {
        id: 'm1',
        category: 'user_fact',
      } as never,
      {
        id: 'm2',
        category: 'user_preference',
      } as never,
    ]);

    expect(memorySummary.retrievedCount).toBe(2);
    expect(memorySummary.categories).toEqual(['user_fact', 'user_preference']);

    const intent = buildTurnTraceIntent({
      photoRequested: true,
      explicitPhotoRequest: false,
      heuristicLocked: true,
      intent: {
        wantsPhoto: true,
        photoDelivery: 'send_now',
        imageCategory: 'outfit',
        visualSceneHint: 'rooftop sunset',
      } as never,
    });

    expect(intent.photoDelivery).toBe('send_now');
    expect(intent.imageCategory).toBe('outfit');
  });
});