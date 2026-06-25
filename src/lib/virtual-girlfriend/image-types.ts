/*
 * Provider-agnostic generated-image shape.
 * The Flux provider returns this structure so the image machine never needs to
 * know which concrete provider produced an image.
 */
export type ImageProviderName = 'flux' | 'modelslab';

export type KontextGenerationOptions = {
  guidanceScale?: number;
  numInferenceSteps?: number;
  enableSafetyChecker?: boolean;
  resolutionMode?: string;
};

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
  /** Provider-hosted URL when bytes were not downloaded (preview fast path). */
  temporaryUrl?: string | null;
};
