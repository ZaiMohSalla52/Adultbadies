import { describe, expect, it } from 'vitest';
import { resolveChatGenerationRoute } from '@/lib/virtual-girlfriend/image-generation-router';

describe('resolveChatGenerationRoute', () => {
  it('raises guidance for requested-look wardrobe changes', () => {
    const route = resolveChatGenerationRoute({
      explicit: false,
      requestedLook: true,
      adultContentEnabled: true,
    });
    expect(route.guidanceScale).toBeGreaterThan(4);
    expect(route.provider).toBe('flux_kontext');
  });

  it('routes explicit adult chat to kontext dev without safety checker', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
    });
    expect(route.modelKind).toBe('kontext_dev');
    expect(route.enableSafetyChecker).toBe(false);
    expect(route.guidanceScale).toBeGreaterThan(5);
  });

  it('raises guidance further for high-exposure explicit requests', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: true,
    });
    expect(route.guidanceScale).toBe(7.5);
    expect(route.numInferenceSteps).toBe(36);
  });
});