/*
 * Single routing policy for in-chat image generation.
 *
 * Kontext Pro applies hosted moderation and blanks explicit content to black /
 * safe images even with enable_safety_checker:false. It must NEVER handle
 * explicit or sexual in-chat requests.
 *
 * Explicit nude/topless → Face Gen first (uncensored face lock + new scene)
 * Pose-heavy (ass/genital) → Face swap first (body text2img + single-face-swap)
 * Face Gen timeout/clone/failure → face swap or Kontext dev / SDXL
 * Sexual requested-look → Face Gen on ModelsLab (uncensored, face-locked)
 * Flux-only explicit fallback → Kontext [dev] with safety checker OFF
 * Passive SFW chat only → Kontext Pro (safety on)
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
    // Img2img (Kontext dev / Aurelium SDXL) keeps the clothed canonical — Face Gen first.
    if (input.preferFaceGen ?? true) {
      return {
        provider: 'face_gen',
        modelKind: 'face_gen',
        guidanceScale: 7.5,
        numInferenceSteps: 41,
        enableSafetyChecker: false,
      };
    }

    if (input.highExposure) {
      return {
        provider: 'flux_kontext',
        modelKind: 'kontext_dev',
        guidanceScale: 7,
        numInferenceSteps: 32,
        enableSafetyChecker: false,
      };
    }

    if (input.preferSdxl ?? true) {
      return {
        provider: 'sdxl',
        modelKind: 'sdxl',
        guidanceScale: 6.5,
        numInferenceSteps: 32,
        enableSafetyChecker: false,
      };
    }

    return {
      provider: 'flux_kontext',
      modelKind: 'kontext_dev',
      guidanceScale: 6.5,
      numInferenceSteps: 32,
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