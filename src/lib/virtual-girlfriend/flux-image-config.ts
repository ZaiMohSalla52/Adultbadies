/** fal.ai portrait text2img — bake-off winner (uncensored). */
export const FAL_FLUX_PORTRAIT_MODEL = 'fal-ai/flux/dev';

/** fal.ai gallery img2img from canonical — bake-off winner (uncensored kontext). */
export const FAL_FLUX_GALLERY_MODEL = 'fal-ai/flux-kontext/dev';

export const resolveFalFluxPortraitModel = () => FAL_FLUX_PORTRAIT_MODEL;

export const resolveFalFluxGalleryModel = () => FAL_FLUX_GALLERY_MODEL;

export const assertFluxApiKey = () => {
  const key = process.env.FLUX_API_KEY?.trim();
  if (!key) {
    throw new Error('FLUX_API_KEY is required for portrait and gallery generation.');
  }
  return key;
};

export const isFluxRateLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('rate limit') || message.includes('429');
};

export const isFluxModerationError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('moderated') || message.includes('nsfw') || message.includes('safety');
};