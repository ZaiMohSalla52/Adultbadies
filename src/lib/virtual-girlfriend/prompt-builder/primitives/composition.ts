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
  'Playful half-smile with bright eyes, candid charm.',
  'Serene composed expression, quiet magnetic confidence.',
  'Flirtatious knowing glance, relaxed lips, natural chemistry.',
  'Bright open laugh, joyful candid energy.',
  'Intense focused stare, subtle smolder, adult allure.',
  'Gentle shy smile, soft vulnerable warmth.',
  'Bold direct eye contact, self-assured sensual presence.',
  'Dreamy off-camera gaze, cinematic romantic mood.',
];

export const PREVIEW_LIGHTING_VARIANTS: string[] = [
  'Warm golden natural window light, soft directional warmth.',
  'Cinematic warm side lighting, slight rim light on hair.',
  'Clean outdoor natural daylight, soft shadows.',
  'Warm indoor ambient light, intimate atmospheric glow.',
  'Late-afternoon sun flare, honey-toned skin highlights.',
  'Soft overcast daylight, even flattering skin tones.',
  'Moody bar or lounge ambient light, rich warm shadows.',
  'Bright café window light, crisp natural color.',
  'Neon-accented urban night light, cinematic color contrast.',
  'Cozy bedroom lamp glow, intimate low-key warmth.',
  'Open-shade outdoor portrait light, clean detail.',
  'Backlit golden hour rim light with soft fill on face.',
];

export function getPreviewLightingVariant(variantIndex: number): string {
  return PREVIEW_LIGHTING_VARIANTS[variantIndex % PREVIEW_LIGHTING_VARIANTS.length];
}

export const PREVIEW_FRAMING_VARIANTS: string[] = [
  'Close portrait, head and shoulders, face prominent.',
  'Upper chest and face, slight breathing room, natural crop.',
  'Tight face-forward portrait, eyes at upper third.',
  'Natural waist-up relaxed framing, slight environmental context.',
  'Three-quarter angle portrait, natural shoulder turn, dimensional face.',
  'Slightly off-center composition, candid documentary framing.',
  'Environmental portrait with soft background context, subject still dominant.',
  'Tight crop from collarbone up, intimate portrait energy.',
  'Relaxed seated portrait framing, natural posture.',
  'Standing portrait with subtle body language, confident stance.',
  'Over-the-shoulder glance back toward camera, dynamic candid angle.',
  'Mirror-adjacent selfie-style crop, authentic phone-photo feel.',
];

export const PREVIEW_SCENE_VARIANTS: string[] = [
  'Urban street background with soft bokeh.',
  'Cozy apartment interior with warm decor blur.',
  'Sunlit park or garden greenery in the background.',
  'Modern café or restaurant ambiance behind the subject.',
  'Rooftop or balcony cityscape softly out of focus.',
  'Minimal bedroom or living-room setting, intimate and real.',
  'Gym or studio backdrop with clean athletic context.',
  'Bookstore or library shelves softly blurred behind.',
  'Nightlife lounge atmosphere with warm accent lights.',
  'Beach or waterfront natural scenery in soft focus.',
  'Office or workspace hints in the background, professional context.',
  'Art studio or creative space with textured backdrop.',
];

export function getPreviewSceneVariant(variantIndex: number): string {
  return PREVIEW_SCENE_VARIANTS[variantIndex % PREVIEW_SCENE_VARIANTS.length];
}

export function getPreviewFramingVariant(variantIndex: number): string {
  return PREVIEW_FRAMING_VARIANTS[variantIndex % PREVIEW_FRAMING_VARIANTS.length];
}

export const getPreviewExpression = (variantIndex: number): string =>
  PREVIEW_EXPRESSIONS[variantIndex % PREVIEW_EXPRESSIONS.length] ?? PREVIEW_EXPRESSIONS[0];
