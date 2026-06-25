import { describe, expect, it } from 'vitest';
import { resolveChatGenerationRoute } from '@/lib/virtual-girlfriend/image-generation-router';

describe('resolveChatGenerationRoute', () => {
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

  it('routes high-exposure explicit adult chat to Face Gen when enabled', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: true,
      preferFaceGen: true,
    });
    expect(route.provider).toBe('face_gen');
    expect(route.modelKind).toBe('face_gen');
    expect(route.enableSafetyChecker).toBe(false);
    expect(route.numInferenceSteps).toBe(41);
  });

  it('falls back to kontext dev for explicit when Face Gen disabled', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: true,
      preferFaceGen: false,
    });
    expect(route.provider).toBe('flux_kontext');
    expect(route.modelKind).toBe('kontext_dev');
    expect(route.enableSafetyChecker).toBe(false);
  });

  it('routes softer explicit adult chat to Face Gen when ModelsLab is preferred', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: false,
      preferFaceGen: true,
    });
    expect(route.provider).toBe('face_gen');
    expect(route.modelKind).toBe('face_gen');
    expect(route.enableSafetyChecker).toBe(false);
  });

  it('falls back to kontext dev for softer explicit when Face Gen disabled', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: false,
      preferFaceGen: false,
    });
    expect(route.provider).toBe('flux_kontext');
    expect(route.modelKind).toBe('kontext_dev');
    expect(route.enableSafetyChecker).toBe(false);
    expect(route.guidanceScale).toBeGreaterThan(5);
  });

  it('raises guidance further for high-exposure kontext fallback', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: true,
      preferFaceGen: false,
    });
    expect(route.guidanceScale).toBe(7.5);
    expect(route.numInferenceSteps).toBe(36);
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