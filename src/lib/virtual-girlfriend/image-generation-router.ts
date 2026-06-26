/*
 * Single routing policy for in-chat image generation.
 *
 * Kontext Pro applies hosted moderation and blanks explicit content to black /
 * safe images even with enable_safety_checker:false. It must NEVER handle
 * explicit or sexual in-chat requests.
 *
 * Explicit nude/topless → Face Gen body scene + face swap; Face Gen fallback on failure
 * Sexual requested-look → Face swap when adult content enabled
 * Passive SFW chat only → Kontext Pro (safety on)
 */

export type ChatGenerationProvider = 'sdxl' | 'face_gen' | 'face_swap' | 'flux_kontext';

export type ChatGenerationRoute = {
  provider: ChatGenerationProvider;
  modelKind: 'sdxl' | 'face_gen' | 'face_swap' | 'kontext_pro' | 'kontext_dev';
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

  if (adultChat) {
    return {
      provider: 'face_swap',
      modelKind: 'face_swap',
      guidanceScale: 7.5,
      numInferenceSteps: 31,
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