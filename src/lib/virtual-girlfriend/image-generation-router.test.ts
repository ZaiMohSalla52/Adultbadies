import { describe, expect, it } from 'vitest';
import { resolveChatGenerationRoute } from '@/lib/virtual-girlfriend/image-generation-router';

describe('resolveChatGenerationRoute', () => {
  it('routes explicit adult chat to SDXL when ModelsLab preferred', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: true,
      preferSdxl: true,
    });
    expect(route.provider).toBe('sdxl');
    expect(route.modelKind).toBe('sdxl');
    expect(route.enableSafetyChecker).toBe(false);
    expect(route.numInferenceSteps).toBe(36);
  });

  it('routes softer explicit adult chat to SDXL when enabled', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: false,
      preferSdxl: true,
    });
    expect(route.provider).toBe('sdxl');
    expect(route.modelKind).toBe('sdxl');
    expect(route.enableSafetyChecker).toBe(false);
    expect(route.guidanceScale).toBeGreaterThan(5);
  });

  it('falls back to kontext dev for explicit when SDXL disabled', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: true,
      preferSdxl: false,
    });
    expect(route.provider).toBe('flux_kontext');
    expect(route.modelKind).toBe('kontext_dev');
    expect(route.enableSafetyChecker).toBe(false);
  });

  it('routes adult requested-look chat to Face Gen when ModelsLab preferred', () => {
    const route = resolveChatGenerationRoute({
      explicit: false,
      requestedLook: true,
      adultContentEnabled: true,
      preferFaceGen: true,
    });
    expect(route.provider).toBe('face_gen');
    expect(route.modelKind).toBe('face_gen');
    expect(route.enableSafetyChecker).toBe(false);
  });

  it('falls back to kontext dev for requested look when Face Gen disabled', () => {
    const route = resolveChatGenerationRoute({
      explicit: false,
      requestedLook: true,
      adultContentEnabled: true,
      preferFaceGen: false,
    });
    expect(route.provider).toBe('flux_kontext');
    expect(route.modelKind).toBe('kontext_dev');
    expect(route.enableSafetyChecker).toBe(false);
  });

  it('uses kontext pro with safety for non-adult passive chat', () => {
    const route = resolveChatGenerationRoute({
      explicit: false,
      requestedLook: false,
      adultContentEnabled: false,
    });
    expect(route.provider).toBe('flux_kontext');
    expect(route.modelKind).toBe('kontext_pro');
    expect(route.enableSafetyChecker).toBe(true);
  });
});