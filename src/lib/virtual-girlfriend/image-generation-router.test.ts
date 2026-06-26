import { describe, expect, it } from 'vitest';
import { resolveChatGenerationRoute } from '@/lib/virtual-girlfriend/image-generation-router';

describe('resolveChatGenerationRoute', () => {
  it('routes explicit nude chat to face swap', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: true,
      preferFaceGen: true,
      preferSdxl: true,
    });
    expect(route.provider).toBe('face_swap');
    expect(route.modelKind).toBe('face_swap');
    expect(route.enableSafetyChecker).toBe(false);
    expect(route.numInferenceSteps).toBe(31);
  });

  it('routes softer explicit adult chat to face swap', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      highExposure: false,
      preferSdxl: true,
      preferFaceGen: true,
    });
    expect(route.provider).toBe('face_swap');
    expect(route.modelKind).toBe('face_swap');
    expect(route.enableSafetyChecker).toBe(false);
  });

  it('routes adult requested-look chat to face swap', () => {
    const route = resolveChatGenerationRoute({
      explicit: false,
      requestedLook: true,
      adultContentEnabled: true,
      preferFaceGen: true,
    });
    expect(route.provider).toBe('face_swap');
    expect(route.modelKind).toBe('face_swap');
    expect(route.enableSafetyChecker).toBe(false);
  });

  it('falls back to kontext dev for requested look when adult content disabled', () => {
    const route = resolveChatGenerationRoute({
      explicit: false,
      requestedLook: true,
      adultContentEnabled: false,
      preferFaceGen: false,
    });
    expect(route.provider).toBe('flux_kontext');
    expect(route.modelKind).toBe('kontext_dev');
    expect(route.enableSafetyChecker).toBe(true);
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

  it('never routes explicit adult chat to kontext pro or sdxl', () => {
    const route = resolveChatGenerationRoute({
      explicit: true,
      requestedLook: true,
      adultContentEnabled: true,
      preferSdxl: true,
      preferFaceGen: false,
    });
    expect(route.provider).toBe('face_swap');
    expect(route.modelKind).not.toBe('kontext_pro');
    expect(route.modelKind).not.toBe('sdxl');
    expect(route.enableSafetyChecker).toBe(false);
  });
});