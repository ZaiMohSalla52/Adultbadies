export type VgImageProvider = 'modelslab' | 'flux';

export const resolveVgImageProvider = (): VgImageProvider => {
  const configured = process.env.VG_IMAGE_PROVIDER?.trim().toLowerCase();
  if (configured === 'modelslab' || configured === 'flux') {
    return configured;
  }

  if (process.env.MODELSLAB_API_KEY?.trim()) return 'modelslab';
  return 'flux';
};