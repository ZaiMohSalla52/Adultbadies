/*
 * SurfaceType — valid image-generation surfaces.
 * Adding a new surface later requires:
 * 1. adding it here
 * 2. adding prompt version
 * 3. adding params in image-surfaces.ts
 * 4. adding prompt-builder implementation
 */

export type SurfaceType = 'preview' | 'canonical' | 'regenerate' | 'gallery' | 'chat';

export type PortraitSurface = Extract<SurfaceType, 'preview' | 'canonical' | 'regenerate' | 'gallery'>;

export type NonPreviewSurface = Exclude<SurfaceType, 'preview'>;
