/*
 * Single routing policy for in-chat image generation.
 *
 * Today: Flux Kontext via fal.ai for all chat surfaces.
 * - SFW / identity-heavy: hosted Kontext pro (default safety on).
 * - Adult explicit chat: open-weights Kontext dev (safety checker off).
 *
 * guidance_scale tunes prompt vs reference adherence on Kontext:
 * higher values honor wardrobe/scene directives over the reference outfit.
 * Stable Diffusion is intentionally not wired yet — add a second provider here
 * only if Kontext dev still fails explicit adherence after prompt/routing fixes.
 */

export type ChatGenerationRoute = {
  provider: 'flux_kontext';
  modelKind: 'kontext_pro' | 'kontext_dev';
  guidanceScale: number;
  numInferenceSteps: number;
  enableSafetyChecker: boolean;
};

export const resolveChatGenerationRoute = (input: {
  explicit: boolean;
  requestedLook: boolean;
  adultContentEnabled: boolean;
}): ChatGenerationRoute => {
  const adultChat = input.adultContentEnabled && input.explicit;

  if (adultChat) {
    return {
      provider: 'flux_kontext',
      modelKind: 'kontext_dev',
      guidanceScale: input.requestedLook ? 6.5 : 5,
      numInferenceSteps: 32,
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