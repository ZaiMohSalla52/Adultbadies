import { describe, expect, it } from 'vitest';
import { isNearCloneOfReference } from '@/lib/virtual-girlfriend/image-clone-detection';

describe('isNearCloneOfReference', () => {
  it('detects near-identical buffers', () => {
    const reference = Buffer.alloc(8_000, 120);
    const clone = Buffer.from(reference);
    expect(isNearCloneOfReference(reference, clone)).toBe(true);
  });

  it('allows clearly different buffers', () => {
    const reference = Buffer.alloc(8_000, 40);
    const different = Buffer.alloc(8_000, 200);
    expect(isNearCloneOfReference(reference, different)).toBe(false);
  });
});