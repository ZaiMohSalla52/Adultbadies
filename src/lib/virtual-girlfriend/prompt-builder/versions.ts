/*
 * Prompt version registry.
 * Bump the version string when prompt semantics change for a surface.
 * Never reuse a version string once it has been used in production.
 * Version is persisted per generated image in Phase 5.
 */

export const PROMPT_VERSION = {
  preview: 'preview_v2',
  canonical: 'canonical_v1',
  regenerate: 'regenerate_v1',
  gallery: 'gallery_v1',
  chat: 'chat_image_v1',
} as const;

export type SurfaceType = keyof typeof PROMPT_VERSION;
export type PromptVersion = (typeof PROMPT_VERSION)[SurfaceType];
