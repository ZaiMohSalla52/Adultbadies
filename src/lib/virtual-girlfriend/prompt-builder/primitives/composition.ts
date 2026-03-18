import type { SurfaceType } from '../versions';

export const COMPOSITION_ANCHORS: Record<SurfaceType, string> = {
  preview:
    'One face filling most of the frame. Head and shoulders portrait. Centered subject. Straightforward realistic portrait photography. Plain uncluttered background. Natural lighting. Clear facial visibility.',
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
  'Neutral relaxed expression.',
  'Soft natural smile.',
  'Calm confident expression.',
  'Gentle thoughtful expression.',
];

export const getPreviewExpression = (variantIndex: number): string =>
  PREVIEW_EXPRESSIONS[variantIndex % PREVIEW_EXPRESSIONS.length] ?? PREVIEW_EXPRESSIONS[0];
