import { describe, expect, it } from 'vitest';
import {
  containsMinorSafetyRisk,
  moderateVirtualGirlfriendContent,
  moderateVirtualGirlfriendImageRequest,
} from '@/lib/virtual-girlfriend/safety';

describe('containsMinorSafetyRisk', () => {
  it('flags explicit minor ages', () => {
    expect(containsMinorSafetyRisk('she is 15 years old')).toBe(true);
    expect(containsMinorSafetyRisk('a seventeen years old girl')).toBe(true);
  });

  it('flags self-declared minors', () => {
    expect(containsMinorSafetyRisk("i'm 16")).toBe(true);
    expect(containsMinorSafetyRisk('i am a minor')).toBe(true);
  });

  it('flags minor-coded subjects in sexual context', () => {
    expect(containsMinorSafetyRisk('nude schoolgirl')).toBe(true);
    expect(containsMinorSafetyRisk('sexy teen photo')).toBe(true);
  });

  it('does not flag ordinary adult content', () => {
    expect(containsMinorSafetyRisk('a 25 year old woman in a red dress')).toBe(false);
    expect(containsMinorSafetyRisk('send me a selfie')).toBe(false);
  });
});

describe('moderateVirtualGirlfriendContent', () => {
  it('blocks minor-safety risk regardless of other content', () => {
    expect(moderateVirtualGirlfriendContent('she is 14 years old').allowed).toBe(false);
  });

  it('allows normal messages', () => {
    expect(moderateVirtualGirlfriendContent('hey how was your day').allowed).toBe(true);
  });
});

describe('moderateVirtualGirlfriendImageRequest', () => {
  it('permits adult terms by default on Adult Badies', () => {
    const previous = process.env.VG_ALLOW_ADULT_CONTENT;
    delete process.env.VG_ALLOW_ADULT_CONTENT;
    expect(moderateVirtualGirlfriendImageRequest('send a nude').allowed).toBe(true);
    if (previous === undefined) delete process.env.VG_ALLOW_ADULT_CONTENT;
    else process.env.VG_ALLOW_ADULT_CONTENT = previous;
  });

  it('blocks adult terms when adult content is disabled', () => {
    const previous = process.env.VG_ALLOW_ADULT_CONTENT;
    process.env.VG_ALLOW_ADULT_CONTENT = 'false';
    expect(moderateVirtualGirlfriendImageRequest('send a nude').allowed).toBe(false);
    if (previous === undefined) delete process.env.VG_ALLOW_ADULT_CONTENT;
    else process.env.VG_ALLOW_ADULT_CONTENT = previous;
  });

  it('permits adult terms when adult content is explicitly allowed', () => {
    expect(moderateVirtualGirlfriendImageRequest('send a nude', { allowAdultContent: true }).allowed).toBe(true);
  });

  it('always blocks minor-safety risk even when adult content is allowed', () => {
    expect(
      moderateVirtualGirlfriendImageRequest('nude teen', { allowAdultContent: true }).allowed,
    ).toBe(false);
  });
});
