import { describe, expect, it } from 'vitest';
import {
  detectExplicitImageIntent,
  isVirtualGirlfriendAdultContentEnabled,
} from '@/lib/virtual-girlfriend/adult-content';

describe('isVirtualGirlfriendAdultContentEnabled', () => {
  it('defaults to enabled for Adult Badies', () => {
    const previous = process.env.VG_ALLOW_ADULT_CONTENT;
    delete process.env.VG_ALLOW_ADULT_CONTENT;
    expect(isVirtualGirlfriendAdultContentEnabled()).toBe(true);
    if (previous === undefined) delete process.env.VG_ALLOW_ADULT_CONTENT;
    else process.env.VG_ALLOW_ADULT_CONTENT = previous;
  });

  it('respects explicit disable flag', () => {
    const previous = process.env.VG_ALLOW_ADULT_CONTENT;
    process.env.VG_ALLOW_ADULT_CONTENT = 'false';
    expect(isVirtualGirlfriendAdultContentEnabled()).toBe(false);
    if (previous === undefined) delete process.env.VG_ALLOW_ADULT_CONTENT;
    else process.env.VG_ALLOW_ADULT_CONTENT = previous;
  });
});

describe('detectExplicitImageIntent', () => {
  it('detects explicit photo requests when adult mode is on', () => {
    const previous = process.env.VG_ALLOW_ADULT_CONTENT;
    delete process.env.VG_ALLOW_ADULT_CONTENT;
    expect(detectExplicitImageIntent('send me a nude selfie')).toBe(true);
    expect(detectExplicitImageIntent('show me topless')).toBe(true);
    if (previous === undefined) delete process.env.VG_ALLOW_ADULT_CONTENT;
    else process.env.VG_ALLOW_ADULT_CONTENT = previous;
  });

  it('does not detect explicit intent when adult mode is off', () => {
    const previous = process.env.VG_ALLOW_ADULT_CONTENT;
    process.env.VG_ALLOW_ADULT_CONTENT = 'false';
    expect(detectExplicitImageIntent('send me a nude selfie')).toBe(false);
    if (previous === undefined) delete process.env.VG_ALLOW_ADULT_CONTENT;
    else process.env.VG_ALLOW_ADULT_CONTENT = previous;
  });
});