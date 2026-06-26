/** Detect when img2img returned the clothed canonical with almost no change. */
export const isNearCloneOfReference = (reference: Buffer, generated: Buffer) => {
  if (!reference.byteLength || !generated.byteLength) return false;

  const sizeRatio = generated.byteLength / reference.byteLength;
  if (sizeRatio > 0.92 && sizeRatio < 1.08) {
    const sampleCount = Math.min(400, Math.floor(Math.min(reference.byteLength, generated.byteLength) / 64));
    if (sampleCount < 20) return false;

    let matches = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const offset = Math.floor((i / sampleCount) * (Math.min(reference.byteLength, generated.byteLength) - 1));
      if (Math.abs(reference[offset]! - generated[offset]!) <= 2) matches += 1;
    }

    if (matches / sampleCount >= 0.94) return true;
  }

  return false;
};