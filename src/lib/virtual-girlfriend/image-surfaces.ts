/*
 * SURFACE_PARAMS — future single source of truth for Ideogram provider params per surface.
 *
 * Rules:
 * - Do not change live generation behavior in this phase
 * - Do not automatically rewire existing runtime generation to use this registry yet
 * - This file is architecture scaffolding for later phases
 * - Values must match current intended runtime behavior, especially Phase 1 preview settings
 */

import type { SurfaceType } from './types/surfaces';

export interface IdeogramSurfaceParams {
  aspect_ratio: string;
  num_images: 1;
  magic_prompt_option: 'ON' | 'OFF';
  style_type: 'REALISTIC' | 'AUTO' | 'GENERAL' | 'DESIGN';
  rendering_speed: 'DEFAULT' | 'TURBO' | 'QUALITY';
}

export const SURFACE_PARAMS: Record<SurfaceType, IdeogramSurfaceParams> = {
  preview: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'DEFAULT',
  },
  canonical: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'DEFAULT',
  },
  regenerate: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'DEFAULT',
  },
  gallery: {
    aspect_ratio: '3x4',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'REALISTIC',
    rendering_speed: 'DEFAULT',
  },
  chat: {
    aspect_ratio: '1x1',
    num_images: 1,
    magic_prompt_option: 'OFF',
    style_type: 'AUTO',
    rendering_speed: 'TURBO',
  },
} as const;

export function getSurfaceParams(surface: SurfaceType): IdeogramSurfaceParams {
  return SURFACE_PARAMS[surface];
}

export function describeSurfaceParams(surface: SurfaceType): string {
  const params = getSurfaceParams(surface);
  return `${surface}: ratio=${params.aspect_ratio}, style=${params.style_type}, speed=${params.rendering_speed}, magic=${params.magic_prompt_option}, num_images=${params.num_images}`;
}
