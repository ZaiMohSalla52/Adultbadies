import { describe, expect, it } from 'vitest';
import { isUsablePortraitImageBytes } from '@/lib/virtual-girlfriend/image-luminance';

describe('isUsablePortraitImageBytes', () => {
  it('rejects empty buffers', () => {
    expect(isUsablePortraitImageBytes(Buffer.alloc(0))).toBe(false);
  });

  it('rejects tiny placeholder buffers', () => {
    expect(isUsablePortraitImageBytes(Buffer.alloc(4_000))).toBe(false);
  });

  it('rejects mostly zero-filled buffers', () => {
    const bytes = Buffer.alloc(40_000, 0);
    expect(isUsablePortraitImageBytes(bytes)).toBe(false);
  });

  it('accepts buffers with mixed byte values', () => {
    const bytes = Buffer.alloc(40_000);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = (i * 37) % 255;
    }
    expect(isUsablePortraitImageBytes(bytes)).toBe(true);
  });
});