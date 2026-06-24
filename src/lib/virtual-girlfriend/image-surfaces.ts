/*
 * SURFACE_PARAMS — per-surface image generation parameters.
 *
 * The Flux provider consumes `aspect_ratio` and `num_images`. The remaining
 * fields (magic_prompt_option, style_type, rendering_speed) are legacy
 * descriptors retained for documentation/intent; they are not sent to Flux.
 */

import type { SurfaceType } from './types/surfaces';

export interface SurfaceImageParams {
  aspect_ratio: string;
  num_images: 1;
  magic_prompt_option: 'ON' | 'OFF';
  style_type: 'REALISTIC' | 'AUTO' | 'GENERAL' | 'DESIGN';
  rendering_speed: 'DEFAULT' | 'TURBO' | 'QUALITY';
}

export const SURFACE_PARAMS: Record<SurfaceType, SurfaceImageParams> = {
  preview: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'QUALITY',
  },
  canonical: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'QUALITY',
  },
  regenerate: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'QUALITY',
  },
  gallery: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'QUALITY',
  },
  chat: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'DEFAULT',
  },
} as const;

export function getSurfaceParams(surface: SurfaceType): SurfaceImageParams {
  return SURFACE_PARAMS[surface];
}

export function describeSurfaceParams(surface: SurfaceType): string {
  const params = getSurfaceParams(surface);
  return `${surface}: ratio=${params.aspect_ratio}, style=${params.style_type}, speed=${params.rendering_speed}, magic=${params.magic_prompt_option}, num_images=${params.num_images}`;
}
