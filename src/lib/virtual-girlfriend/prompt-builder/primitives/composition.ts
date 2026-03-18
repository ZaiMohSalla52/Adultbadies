import type { SurfaceType } from '../versions';

export const COMPOSITION_ANCHORS: Record<SurfaceType, string> = {
  preview:
    'Natural head and shoulders portrait. One person only, centered frame. Warm natural lighting. Soft neutral background with gentle depth. Realistic portrait photography with natural skin texture and genuine expression.',
  canonical:
    'Upper body portrait. Centered subject. Realistic portrait photography. Natural lighting. Clear facial features. Simple background.',
  regenerate:
    'Upper body portrait. Centered subject. Realistic portrait photography. Consistent with established identity. Natural lighting. Clear facial features.',
  gallery:
    'Three-quarter body or upper body shot. Natural environment or simple background. Realistic photography. Clear subject visibility.',
  chat:
    'Natural candid portrait. Environment appropriate to context. Realistic photography. Clear subject visibility.',
};

export const getCompositionAnchor = (surface: SurfaceType): string => COMPOSITION_ANCHORS[surface];

export const PREVIEW_EXPRESSIONS: string[] = [
  'Direct confident gaze, relaxed and natural.',
  'Warm genuine smile, eyes bright and engaged.',
  'Soft thoughtful look, slight natural head tilt.',
  'Calm candid expression, unposed and real.',
];

export const PREVIEW_LIGHTING_VARIANTS: string[] = [
  'Soft front natural lighting.',
  'Warm golden side lighting.',
  'Clean diffused window light.',
  'Even soft studio lighting.',
];

export function getPreviewLightingVariant(variantIndex: number): string {
  return PREVIEW_LIGHTING_VARIANTS[variantIndex % PREVIEW_LIGHTING_VARIANTS.length];
}

export const PREVIEW_FRAMING_VARIANTS: string[] = [
  'Tight head and shoulders.',
  'Head and upper chest, slight breathing room.',
  'Close portrait, face prominent.',
  'Natural portrait crop, relaxed framing.',
];

export function getPreviewFramingVariant(variantIndex: number): string {
  return PREVIEW_FRAMING_VARIANTS[variantIndex % PREVIEW_FRAMING_VARIANTS.length];
}

export const getPreviewExpression = (variantIndex: number): string =>
  PREVIEW_EXPRESSIONS[variantIndex % PREVIEW_EXPRESSIONS.length] ?? PREVIEW_EXPRESSIONS[0];
