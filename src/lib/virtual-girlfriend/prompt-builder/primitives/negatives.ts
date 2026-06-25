/*
 * Central hard negatives registry.
 * All surfaces inherit from this.
 * Add new exclusions here — never in individual surface builders.
 * Negatives must always appear LAST in assembled prompts.
 */

export const HARD_NEGATIVES = {
  composition: [
    'no second person',
    'no duplicate person',
    'no twin',
    'no mirrored subject',
    'no repeated face',
    'no side-by-side subject',
    'no collage',
    'no diptych',
    'no triptych',
    'no split screen',
    'no grid',
    'no carousel',
    'no editorial layout',
    'no bilateral face split',
    'no vertical face seam',
    'no symmetry stitch artifact',
    'no duplicated facial halves',
    'no half-face mismatch',
  ],
  mockup: [
    'no phone frame',
    'no mobile app UI',
    'no camera interface',
    'no mockup',
    'no screenshot',
    'no device frame',
  ],
  overlay: [
    'no text overlay',
    'no watermark',
    'no logo',
    'no caption',
  ],
  content: [
    'no nudity',
    'no explicit content',
  ],
  exposure: [
    'no underexposure',
    'no too dark',
    'no muddy shadows hiding the face',
    'no black crush',
    'no silhouette subject',
    'no unreadable low-light face',
  ],
  style: [
    'no anime',
    'no cartoon',
    'no illustration',
    'no drawn',
    'no painted',
    'no CGI',
    'no 3d render',
    'no cel shading',
    'no manga',
    'no stylized art',
    'no doll',
    'no plastic skin',
    'no video game character',
    'no animated',
    'no digital art',
    'no airbrushed fantasy portrait',
  ],
} as const;

export const buildNegatives = (categories: Array<keyof typeof HARD_NEGATIVES>): string =>
  categories.flatMap((category) => HARD_NEGATIVES[category]).join(', ');

export const buildAllNegatives = (): string =>
  buildNegatives(Object.keys(HARD_NEGATIVES) as Array<keyof typeof HARD_NEGATIVES>);

export const buildIdentityNegatives = (): string =>
  buildNegatives(['composition', 'mockup', 'overlay']);

export function buildPreviewNegativePrompt(): string {
  return buildAllNegatives();
}

/** ModelsLab `negative_prompt` field — comma-separated, no inline "no" prefix. */
export function buildModelsLabNegativePrompt(): string {
  const styleBlock =
    'anime, cartoon, illustration, manga, cel shading, CGI, 3d render, digital art, painted, stylized art, doll, plastic skin, video game character, animated, airbrushed fantasy portrait';
  const qualityBlock =
    'worst quality, low quality, blurry, distorted, bad anatomy, deformed, disfigured, extra limbs, bad hands, bad face, watermark, text, logo';
  return [styleBlock, qualityBlock, buildAllNegatives().replace(/\bno /g, '')].join(', ');
}

export function buildChatNegativePrompt(input: { allowAdultContent?: boolean } = {}): string {
  const categories: Array<keyof typeof HARD_NEGATIVES> = input.allowAdultContent
    ? ['composition', 'exposure']
    : ['composition', 'content', 'exposure'];
  return buildNegatives(categories);
}
