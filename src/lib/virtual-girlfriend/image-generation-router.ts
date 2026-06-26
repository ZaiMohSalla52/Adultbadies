/*
 * Single routing policy for in-chat image generation.
 *
 * Explicit adult chat routes to SDXL img2img (face-locked, uncensored).
 * Non-explicit requested-look adult chat can still use Face Gen on ModelsLab.
 * Flux Kontext is retained for SFW passive chat and as an explicit fallback
 * when ModelsLab SDXL is unavailable.
 */

export type ChatGenerationProvider = 'sdxl' | 'face_gen' | 'flux_kontext';

export type ChatGenerationRoute = {
  provider: ChatGenerationProvider;
  modelKind: 'sdxl' | 'face_gen' | 'kontext_pro' | 'kontext_dev';
  guidanceScale: number;
  numInferenceSteps: number;
  enableSafetyChecker: boolean;
};

export const resolveChatGenerationRoute = (input: {
  explicit: boolean;
  requestedLook: boolean;
  adultContentEnabled: boolean;
  highExposure?: boolean;
  preferFaceGen?: boolean;
  preferSdxl?: boolean;
}): ChatGenerationRoute => {
  const adultChat = input.adultContentEnabled && (input.explicit || input.requestedLook);

  if (input.adultContentEnabled && input.explicit) {
    if (input.preferSdxl ?? true) {
      return {
        provider: 'sdxl',
        modelKind: 'sdxl',
        guidanceScale: input.highExposure ? 7.5 : 6.5,
        numInferenceSteps: input.highExposure ? 36 : 32,
        enableSafetyChecker: false,
      };
    }

    return {
      provider: 'flux_kontext',
      modelKind: 'kontext_dev',
      guidanceScale: input.highExposure ? 7.5 : 6.5,
      numInferenceSteps: input.highExposure ? 36 : 32,
      enableSafetyChecker: false,
    };
  }

  const useFaceGen = adultChat && (input.preferFaceGen ?? true);

  if (useFaceGen) {
    return {
      provider: 'face_gen',
      modelKind: 'face_gen',
      guidanceScale: 7.5,
      numInferenceSteps: 41,
      enableSafetyChecker: false,
    };
  }

  if (input.requestedLook) {
    return {
      provider: 'flux_kontext',
      modelKind: 'kontext_dev',
      guidanceScale: 5.5,
      numInferenceSteps: 30,
      enableSafetyChecker: !input.adultContentEnabled,
    };
  }

  return {
    provider: 'flux_kontext',
    modelKind: 'kontext_pro',
    guidanceScale: 3.5,
    numInferenceSteps: 28,
    enableSafetyChecker: true,
  };
};