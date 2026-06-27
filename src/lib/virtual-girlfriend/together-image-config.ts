/** Bake-off winner — setup portrait text-to-image. */
export const TOGETHER_DEFAULT_PORTRAIT_MODEL = 'black-forest-labs/FLUX.2-max';

/** Bake-off winner — gallery wardrobe from canonical (image_url). */
export const TOGETHER_DEFAULT_GALLERY_MODEL = 'black-forest-labs/FLUX.1-kontext-max';

export const resolveTogetherPortraitModel = () =>
  process.env.TOGETHER_PORTRAIT_MODEL?.trim() || TOGETHER_DEFAULT_PORTRAIT_MODEL;

export const resolveTogetherGalleryModel = () =>
  process.env.TOGETHER_GALLERY_MODEL?.trim() || TOGETHER_DEFAULT_GALLERY_MODEL;

const portraitProviderOverride = () => process.env.VG_PORTRAIT_PROVIDER?.trim().toLowerCase();
const galleryProviderOverride = () => process.env.VG_GALLERY_PROVIDER?.trim().toLowerCase();

export const hasTogetherApiKey = () => Boolean(process.env.TOGETHER_API_KEY?.trim());

export const isTogetherPortraitEnabled = () => {
  const override = portraitProviderOverride();
  if (override === 'modelslab') return false;
  if (override === 'together') return hasTogetherApiKey();
  return hasTogetherApiKey();
};

export const isTogetherGalleryEnabled = () => {
  const override = galleryProviderOverride();
  if (override === 'modelslab') return false;
  if (override === 'together') return hasTogetherApiKey();
  return hasTogetherApiKey();
};

export const assertTogetherApiKey = () => {
  const key = process.env.TOGETHER_API_KEY?.trim();
  if (!key) {
    throw new Error('TOGETHER_API_KEY is not configured.');
  }
  return key;
};

export const isTogetherRateLimitError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /rate limit|too many requests|HTTP 429|\b429\b/i.test(message);
};