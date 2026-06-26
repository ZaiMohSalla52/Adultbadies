import { buildR2PublicUrl, isR2PublicDeliveryConfigured } from '@/lib/storage/r2';

/** Private S3 API endpoint or bucket-prefixed paths — not browser-loadable. */
export const isBrokenR2DeliveryUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return (
    /r2\.cloudflarestorage\.com/i.test(trimmed)
    || /\/adultbadies-vg-images\//i.test(trimmed)
  );
};

const extractObjectKeyFromBrokenUrl = (url: string) => {
  const bucketPath = url.match(/\/adultbadies-vg-images\/(.+)$/i);
  if (bucketPath?.[1]) return bucketPath[1];

  const storagePath = url.match(/cloudflarestorage\.com\/[^/]+\/(.+)$/i);
  if (storagePath?.[1]) return storagePath[1];

  return null;
};

/**
 * Rebuild companion image delivery URLs from origin_storage_key + R2_PUBLIC_BASE_URL
 * when legacy rows still point at the private cloudflarestorage.com API host.
 */
export const repairCompanionImageDeliveryUrl = (image: {
  delivery_url: string;
  delivery_provider?: string | null;
  origin_storage_provider?: string | null;
  origin_storage_key?: string | null;
}): string => {
  const current = image.delivery_url?.trim() ?? '';
  if (!current) return current;
  if (!isR2PublicDeliveryConfigured()) return current;

  const originKey = image.origin_storage_key?.trim();
  const isR2Backed =
    image.origin_storage_provider === 'cloudflare_r2'
    || image.delivery_provider === 'cloudflare_r2';

  if (originKey && isR2Backed && (isBrokenR2DeliveryUrl(current) || !/\.r2\.dev\//i.test(current))) {
    try {
      return buildR2PublicUrl(originKey);
    } catch {
      // fall through
    }
  }

  if (isBrokenR2DeliveryUrl(current)) {
    const parsedKey = extractObjectKeyFromBrokenUrl(current);
    if (parsedKey) {
      try {
        return buildR2PublicUrl(parsedKey);
      } catch {
        return current;
      }
    }
  }

  return current;
};