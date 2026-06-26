import { inflateSync } from 'node:zlib';

type RgbaImage = {
  width: number;
  height: number;
  data: Buffer;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const paethPredictor = (left: number, up: number, upLeft: number) => {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
};

const applyPngFilter = (filter: number, row: Buffer, prev: Buffer | null, bpp: number) => {
  if (filter === 0) return;
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp]! : 0;
    const up = prev ? prev[i]! : 0;
    const upLeft = prev && i >= bpp ? prev[i - bpp]! : 0;
    if (filter === 1) row[i] = (row[i]! + left) & 0xff;
    else if (filter === 2) row[i] = (row[i]! + up) & 0xff;
    else if (filter === 3) row[i] = (row[i]! + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) row[i] = (row[i]! + paethPredictor(left, up, upLeft)) & 0xff;
  }
};

/** Decode 8-bit RGBA PNGs (ModelsLab output format) for lightweight framing checks. */
export const decodePngRgba = (bytes: Buffer): RgbaImage | null => {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (!width || !height || bitDepth !== 8 || colorType !== 6 || !idatChunks.length) return null;

  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const data = Buffer.alloc(height * stride);
  let src = 0;
  let prev: Buffer | null = null;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[src]!;
    src += 1;
    const row = raw.subarray(src, src + stride);
    src += stride;
    const decoded = Buffer.from(row);
    applyPngFilter(filter, decoded, prev, 4);
    decoded.copy(data, y * stride);
    prev = decoded;
  }

  return { width, height, data };
};

const rowAverageRgb = (image: RgbaImage, y: number) => {
  const stride = image.width * 4;
  const offset = y * stride;
  let r = 0;
  let g = 0;
  let b = 0;
  const samples = Math.max(1, Math.floor(image.width / 8));

  for (let i = 0; i < samples; i += 1) {
    const x = Math.min(image.width - 1, Math.floor((i / samples) * image.width));
    const idx = offset + x * 4;
    r += image.data[idx]!;
    g += image.data[idx + 1]!;
    b += image.data[idx + 2]!;
  }

  return { r: r / samples, g: g / samples, b: b / samples };
};

const colorDistance = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

const looksLikeSkinTone = (rgb: { r: number; g: number; b: number }) =>
  rgb.r > 70 && rgb.r > rgb.g && rgb.g >= rgb.b - 20 && rgb.r - rgb.b < 120;

/**
 * Heuristic: bottom edge color matches mid-body skin tones → legs/feet likely cropped out.
 * Used to trigger a wide-framing Face Gen retry or Kontext fallback.
 */
/** Detect img2img fallbacks that kept jeans/pants on a rear-view explicit request. */
export const isLikelyClothedExplicitFallback = (
  bytes: Buffer,
  level: 'butt_focus' | 'genital_focus' | 'full_nude' | 'topless' | null | undefined,
) => {
  if (level !== 'butt_focus' && level !== 'genital_focus') return false;

  // ModelsLab may return JPEG; skip pixel heuristics when not PNG.
  if (bytes.length < 4 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return false;

  const image = decodePngRgba(bytes);
  if (!image) return false;

  const startY = Math.floor(image.height * 0.45);
  const endY = image.height - 1;
  let denimLike = 0;
  let samples = 0;

  for (let y = startY; y <= endY; y += Math.max(1, Math.floor((endY - startY) / 24))) {
    const stride = image.width * 4;
    const offset = y * stride;
    for (let x = 0; x < image.width; x += Math.max(1, Math.floor(image.width / 12))) {
      const idx = offset + x * 4;
      const r = image.data[idx]!;
      const g = image.data[idx + 1]!;
      const b = image.data[idx + 2]!;
      samples += 1;
      if (b > r + 10 && b > g + 4 && b > 70) denimLike += 1;
    }
  }

  return samples > 0 && denimLike / samples > 0.08;
};

export const isLikelyBodyCroppedAtBottom = (bytes: Buffer) => {
  const image = decodePngRgba(bytes);
  if (!image || image.height < 120) return false;

  const bottomY = image.height - 1;
  const midBodyY = Math.floor(image.height * 0.72);
  const upperY = Math.floor(image.height * 0.42);

  const bottom = rowAverageRgb(image, bottomY);
  const midBody = rowAverageRgb(image, midBodyY);
  const upper = rowAverageRgb(image, upperY);

  const bottomMatchesMidBody = colorDistance(bottom, midBody) < 28;
  const bottomMatchesUpper = colorDistance(bottom, upper) < 32;
  const bottomLooksLikeSkin = looksLikeSkinTone(bottom);

  return bottomLooksLikeSkin && (bottomMatchesMidBody || bottomMatchesUpper);
};