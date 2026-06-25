import type { SurfaceType } from '../versions';

export const COMPOSITION_ANCHORS: Record<SurfaceType, string> = {
  preview:
    'Single person portrait photograph of a real human, centered frame. Real-world setting with soft shallow depth of field and a gently blurred background. Flattering natural light. Sharp eyes, lifelike skin texture with pores and natural imperfections, genuine relaxed expression. Must look like an unedited real photograph, not artwork.',
  canonical:
    'Upper body to waist portrait. Subject centered at natural eye-level. Flattering natural light, soft shallow depth of field, real-world background. Sharp lifelike face with natural skin texture.',
  regenerate:
    'Upper body portrait. Centered subject at natural eye-level. Natural light consistent with established identity. Real-world background, sharp lifelike facial features.',
  gallery:
    'Three-quarter or waist-up framing. Real-world environment with depth and context — outdoors, café, bar, bedroom, urban street. Soft shallow depth of field, candid real-photo feel.',
  chat:
    'Natural candid portrait, waist-up or upper body. Contextual real-world environment suited to the scene. Soft depth of field, authentic phone-photo feel, sharp subject.',
};

export const getCompositionAnchor = (surface: SurfaceType): string => COMPOSITION_ANCHORS[surface];

/*
 * Shared photographic-realism tail.
 *
 * Replaces the older "8k / hyper-realistic / film-quality / professional
 * photography" keyword spam, which biases modern diffusion models (Flux in
 * particular) toward a glossy stock-photo / CGI finish. Candid camera-real
 * language reads as more authentic and attractive. Centralized here so the
 * realism aesthetic can be tuned in one place.
 */
export const PHOTO_REALISM_TAIL =
  'Candid amateur photograph of a real person, shot on a full-frame 35mm camera, natural available light, well-exposed subject with clear visible facial features, balanced brightness, true-to-life skin tones with realistic texture and subtle natural imperfections, soft shallow depth of field, authentic unposed feel. Photorealistic only — not illustration, not animation, not CGI.';

export const EXPOSURE_LIGHTING_TAIL =
  'Face and body clearly lit — no underexposure, no muddy darkness, no silhouette.';

export const PREVIEW_EXPRESSIONS: string[] = [
  'Direct confident gaze into camera, relaxed natural presence.',
  'Warm genuine smile, bright expressive eyes.',
  'Soft thoughtful look, slight natural head tilt, subtle allure.',
  'Calm candid expression, natural unposed authenticity.',
];

export const PREVIEW_LIGHTING_VARIANTS: string[] = [
  'Warm golden natural window light, soft directional warmth.',
  'Cinematic warm side lighting, slight rim light on hair.',
  'Clean outdoor natural daylight, soft shadows.',
  'Warm indoor ambient light, intimate atmospheric glow.',
];

export function getPreviewLightingVariant(variantIndex: number): string {
  return PREVIEW_LIGHTING_VARIANTS[variantIndex % PREVIEW_LIGHTING_VARIANTS.length];
}

export const PREVIEW_FRAMING_VARIANTS: string[] = [
  'Close portrait, head and shoulders, face prominent.',
  'Upper chest and face, slight breathing room, natural crop.',
  'Tight face-forward portrait, eyes at upper third.',
  'Natural waist-up relaxed framing, slight environmental context.',
];

export function getPreviewFramingVariant(variantIndex: number): string {
  return PREVIEW_FRAMING_VARIANTS[variantIndex % PREVIEW_FRAMING_VARIANTS.length];
}

export const getPreviewExpression = (variantIndex: number): string =>
  PREVIEW_EXPRESSIONS[variantIndex % PREVIEW_EXPRESSIONS.length] ?? PREVIEW_EXPRESSIONS[0];
