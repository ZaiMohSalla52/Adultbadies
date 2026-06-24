/*
 * Provider-agnostic generated-image shape.
 * Both the Ideogram and Flux providers return this structure so the image
 * machine never needs to know which provider produced an image.
 */
export type ImageProviderName = 'ideogram' | 'flux';

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  revisedPrompt: string | null;
  provider: ImageProviderName;
  model: string;
  endpoint: string;
  requestId: string | null;
  jobId: string | null;
};
