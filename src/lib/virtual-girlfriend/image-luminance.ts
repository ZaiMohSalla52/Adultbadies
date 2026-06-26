/** Reject provider outputs that are empty or nearly solid black (moderation blanking). */
export const isUsablePortraitImageBytes = (bytes: Buffer) => {
  if (!bytes.byteLength) return false;
  if (bytes.byteLength < 12_000) return false;

  let darkSamples = 0;
  let samples = 0;
  const start = Math.min(128, Math.floor(bytes.length * 0.05));
  const end = Math.min(bytes.length, 120_000);

  for (let i = start; i < end; i += 113) {
    samples += 1;
    if (bytes[i] < 6) darkSamples += 1;
  }

  if (samples === 0) return true;
  return darkSamples / samples < 0.9;
};