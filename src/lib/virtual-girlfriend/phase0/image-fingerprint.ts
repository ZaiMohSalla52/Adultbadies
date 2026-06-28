import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

/** Lower = stricter sibling rejection (catches Holly/Mei-style near-clones). */
export const PHASE0_FACE_SIMILARITY_THRESHOLD = 0.8;

export type DecodedImage = {
  width: number;
  height: number;
  /** RGBA bytes */
  data: Buffer;
};

export const decodeImageBytes = (bytes: Buffer, mimeType?: string | null): DecodedImage => {
  const mime = (mimeType ?? '').toLowerCase();
  const isPng = mime.includes('png') || bytes[0] === 0x89;
  if (isPng) {
    const png = PNG.sync.read(bytes);
    return { width: png.width, height: png.height, data: png.data };
  }

  const decoded = jpeg.decode(bytes, { useTArray: true });
  return {
    width: decoded.width,
    height: decoded.height,
    data: Buffer.from(decoded.data),
  };
};

const sampleGray = (image: DecodedImage, x: number, y: number) => {
  const clampedX = Math.min(image.width - 1, Math.max(0, Math.floor(x)));
  const clampedY = Math.min(image.height - 1, Math.max(0, Math.floor(y)));
  const index = (clampedY * image.width + clampedX) * 4;
  const r = image.data[index] ?? 0;
  const g = image.data[index + 1] ?? 0;
  const b = image.data[index + 2] ?? 0;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** 32×32 grayscale vector normalized to unit length (cosine-friendly). */
export const computeGrayscaleVector = (image: DecodedImage, size = 32): Float32Array => {
  const vector = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const srcX = ((x + 0.5) / size) * image.width;
      const srcY = ((y + 0.5) / size) * image.height;
      vector[y * size + x] = sampleGray(image, srcX, srcY);
    }
  }

  let norm = 0;
  for (let i = 0; i < vector.length; i += 1) {
    norm += vector[i]! * vector[i]!;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = vector[i]! / norm;
  }
  return vector;
};

export const cosineSimilarity = (left: Float32Array, right: Float32Array) => {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let dot = 0;
  for (let i = 0; i < length; i += 1) {
    dot += left[i]! * right[i]!;
  }
  return dot;
};

/** 64-bit difference hash for quick duplicate detection. */
export const computeDifferenceHash = (image: DecodedImage): bigint => {
  const width = 9;
  const height = 8;
  let hash = 0n;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = sampleGray(image, ((x + 0.5) / width) * image.width, ((y + 0.5) / height) * image.height);
      const right = sampleGray(image, ((x + 1.5) / width) * image.width, ((y + 0.5) / height) * image.height);
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
};

export const hammingSimilarity = (left: bigint, right: bigint, bits = 64) => {
  let xor = left ^ right;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return 1 - distance / bits;
};

export type ImageFingerprint = {
  vector: Float32Array;
  dHash: bigint;
};

export const buildImageFingerprint = (bytes: Buffer, mimeType?: string | null): ImageFingerprint => {
  const decoded = decodeImageBytes(bytes, mimeType);
  return {
    vector: computeGrayscaleVector(decoded),
    dHash: computeDifferenceHash(decoded),
  };
};

export const compareFingerprints = (left: ImageFingerprint, right: ImageFingerprint) => {
  const cosine = cosineSimilarity(left.vector, right.vector);
  const dHashSimilarity = hammingSimilarity(left.dHash, right.dHash);
  return {
    cosine,
    dHashSimilarity,
    nearDuplicate: cosine >= PHASE0_FACE_SIMILARITY_THRESHOLD || dHashSimilarity >= 0.88,
  };
};