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
} as const;

export const buildNegatives = (categories: Array<keyof typeof HARD_NEGATIVES>): string =>
  categories.flatMap((category) => HARD_NEGATIVES[category]).join(', ');

export const buildAllNegatives = (): string =>
  buildNegatives(Object.keys(HARD_NEGATIVES) as Array<keyof typeof HARD_NEGATIVES>);

export function buildPreviewNegativePrompt(): string {
  return buildAllNegatives();
}
