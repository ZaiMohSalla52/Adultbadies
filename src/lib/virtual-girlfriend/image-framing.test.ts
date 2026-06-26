import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePngRgba, isLikelyBodyCroppedAtBottom } from '@/lib/virtual-girlfriend/image-framing';

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]! << 24;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

const buildSolidPng = (width: number, height: number, rgb: [number, number, number]) => {
  const stride = width * 4;
  const rawRows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(stride);
    for (let x = 0; x < width; x += 1) {
      const idx = x * 4;
      row[idx] = rgb[0];
      row[idx + 1] = rgb[1];
      row[idx + 2] = rgb[2];
      row[idx + 3] = 255;
    }
    rawRows.push(Buffer.concat([Buffer.from([0]), row]));
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rawRows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

describe('image framing helpers', () => {
  it('decodes solid RGBA PNGs', () => {
    const png = buildSolidPng(8, 12, [180, 140, 120]);
    const decoded = decodePngRgba(png);
    expect(decoded?.width).toBe(8);
    expect(decoded?.height).toBe(12);
    expect(decoded?.data[0]).toBe(180);
  });

  it('flags skin-toned bottom edges as likely body crops', () => {
    const png = buildSolidPng(16, 200, [185, 145, 118]);
    expect(isLikelyBodyCroppedAtBottom(png)).toBe(true);
  });

  it('does not flag dark floor-like bottom edges as body crops', () => {
    const png = buildSolidPng(16, 200, [30, 28, 26]);
    expect(isLikelyBodyCroppedAtBottom(png)).toBe(false);
  });
});