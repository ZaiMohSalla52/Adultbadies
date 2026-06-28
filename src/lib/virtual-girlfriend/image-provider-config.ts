/** Explicit chat routing only — portrait/gallery/canonical always use fal (image-provider). */
export type VgImageProvider = 'modelslab' | 'flux';

export const resolveVgImageProvider = (): VgImageProvider => {
  const configured = process.env.VG_IMAGE_PROVIDER?.trim().toLowerCase();
  if (configured === 'modelslab') return 'modelslab';
  return 'flux';
};