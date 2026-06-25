/*
 * Single routing policy for in-chat image generation.
 *
 * ModelsLab explicit adult chat routes to Face Gen
 * (`/api/v6/image_editing/face_gen`) — the same family the ModelsLab playground
 * uses for face-locked explicit selfies. Flux Kontext dev is kept for softer
 * explicit and wardrobe-change requests.
 *
 * guidance_scale tunes prompt vs reference adherence on Kontext:
 * higher values honor wardrobe/scene directives over the reference outfit.
 */

export type ChatGenerationProvider = 'face_gen' | 'flux_kontext';

export type ChatGenerationRoute = {
  provider: ChatGenerationProvider;
  modelKind: 'face_gen' | 'kontext_pro' | 'kontext_dev';
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
}): ChatGenerationRoute => {
  const adultChat = input.adultContentEnabled && input.explicit;
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

  if (adultChat) {
    return {
      provider: 'flux_kontext',
      modelKind: 'kontext_dev',
      guidanceScale: input.highExposure ? 7.5 : input.requestedLook ? 6.5 : 5,
      numInferenceSteps: input.highExposure ? 36 : 32,
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