-- Repair ai_companion_images.delivery_url rows that used the private R2 S3 API host
-- (r2.cloudflarestorage.com) or bucket-prefixed paths instead of pub-*.r2.dev.
--
-- BEFORE running UPDATE: set r2_public_base to your public bucket URL (no trailing slash).
-- Example: https://pub-0a54ccf5a42042298ab49c9ef3d279ca.r2.dev

-- 1) Preview broken rows
-- SELECT id, image_kind, delivery_provider, origin_storage_key, delivery_url
-- FROM public.ai_companion_images
-- WHERE delivery_url ILIKE '%r2.cloudflarestorage.com%'
--    OR delivery_url ILIKE '%/adultbadies-vg-images/%'
-- ORDER BY created_at DESC;

-- 2) Rebuild from origin_storage_key (preferred — canonical storage path)
UPDATE public.ai_companion_images
SET delivery_url = 'https://pub-0a54ccf5a42042298ab49c9ef3d279ca.r2.dev/' || regexp_replace(origin_storage_key, '^/+', '')
WHERE coalesce(origin_storage_key, '') <> ''
  AND origin_storage_provider = 'cloudflare_r2'
  AND (
    delivery_url ILIKE '%r2.cloudflarestorage.com%'
    OR delivery_url ILIKE '%/adultbadies-vg-images/%'
    OR delivery_url NOT ILIKE '%.r2.dev/%'
  );

-- 3) Fallback: strip bucket prefix from broken URL when origin key is missing
UPDATE public.ai_companion_images
SET delivery_url = 'https://pub-0a54ccf5a42042298ab49c9ef3d279ca.r2.dev/' || substring(delivery_url from '/adultbadies-vg-images/(.+)$')
WHERE delivery_url ILIKE '%/adultbadies-vg-images/%'
  AND delivery_url NOT ILIKE '%.r2.dev/%';

-- 4) Verify
-- SELECT id, image_kind, delivery_url
-- FROM public.ai_companion_images
-- WHERE image_kind IN ('canonical', 'gallery')
-- ORDER BY created_at DESC
-- LIMIT 20;