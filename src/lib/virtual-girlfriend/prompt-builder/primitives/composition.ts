import type { SurfaceType } from '../versions';

export const COMPOSITION_ANCHORS: Record<SurfaceType, string> = {
  preview:
    'Single person portrait, centered frame. Natural real-world environment, shallow depth of field, bokeh background. Cinematic natural lighting with directional warmth. Ultra-sharp facial detail, realistic skin texture with natural pores, genuine authentic expression. Hyper-realistic photography, 8k resolution, film-quality.',
  canonical:
    'Upper body to waist portrait. Subject centered, natural perspective. Cinematic lighting, shallow depth of field. Realistic environment background. Ultra-sharp face, natural skin detail, professional photography quality.',
  regenerate:
    'Upper body portrait. Centered subject, natural perspective. Cinematic lighting consistent with established identity. Realistic environment. Ultra-sharp facial features.',
  gallery:
    'Three-quarter body or waist-up framing. Natural real-world environment with depth and context — outdoors, café, bar, bedroom, urban setting. Cinematic shallow depth of field. Realistic candid photography.',
  chat:
    'Natural candid portrait, waist-up or upper body. Contextual environment visible and appropriate to scene. Cinematic depth of field. Realistic photography, sharp subject, atmospheric background.',
};

export const getCompositionAnchor = (surface: SurfaceType): string => COMPOSITION_ANCHORS[surface];

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
