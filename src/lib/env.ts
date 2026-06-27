const getEnv = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'development-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_REVIEWER_EMAILS: process.env.ADMIN_REVIEWER_EMAILS,
  TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
  MODELSLAB_API_KEY: process.env.MODELSLAB_API_KEY,
  VG_LLM_PROVIDER: process.env.VG_LLM_PROVIDER,
  VG_IMAGE_PROVIDER: process.env.VG_IMAGE_PROVIDER,
  MODELSLAB_FLUX_MODEL: process.env.MODELSLAB_FLUX_MODEL,
  MODELSLAB_PORTRAIT_MODEL: process.env.MODELSLAB_PORTRAIT_MODEL,
  MODELSLAB_PORTRAIT_FALLBACK_MODEL: process.env.MODELSLAB_PORTRAIT_FALLBACK_MODEL,
  MODELSLAB_KONTEXT_PRO_MODEL: process.env.MODELSLAB_KONTEXT_PRO_MODEL,
  MODELSLAB_KONTEXT_DEV_MODEL: process.env.MODELSLAB_KONTEXT_DEV_MODEL,
  MODELSLAB_FACE_GEN_MODEL: process.env.MODELSLAB_FACE_GEN_MODEL,
  MODELSLAB_FACE_SWAP_MODEL: process.env.MODELSLAB_FACE_SWAP_MODEL,
  MODELSLAB_EXPLICIT_BODY_MODEL: process.env.MODELSLAB_EXPLICIT_BODY_MODEL,
  MODELSLAB_SDXL_MODEL: process.env.MODELSLAB_SDXL_MODEL,
  // Image generation: Flux via fal.ai (fallback when MODELSLAB_API_KEY unset).
  FLUX_API_KEY: process.env.FLUX_API_KEY,
  FLUX_BASE_URL: process.env.FLUX_BASE_URL,
  FLUX_MODEL: process.env.FLUX_MODEL,
  /** Companion portrait/canonical text2img — defaults to Flux Pro for diversity. */
  FLUX_COMPANION_MODEL: process.env.FLUX_COMPANION_MODEL,
  /** Flux Pro safety_tolerance 1–6; higher is more permissive (default 5 for adult portraits). */
  FLUX_COMPANION_SAFETY_TOLERANCE: process.env.FLUX_COMPANION_SAFETY_TOLERANCE,
  FLUX_KONTEXT_MODEL: process.env.FLUX_KONTEXT_MODEL,
  // Kontext model for adult chat images. Defaults to the open-weights
  // fal-ai/flux-kontext/dev, which honors enable_safety_checker:false and has no
  // hosted moderation gate (so explicit content is not blanked to black).
  FLUX_KONTEXT_DEV_MODEL: process.env.FLUX_KONTEXT_DEV_MODEL,
  // Adult Badies chat images default to fully explicit-capable generation.
  VG_ALLOW_ADULT_CONTENT: process.env.VG_ALLOW_ADULT_CONTENT,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  /** Public HTTPS base for browser delivery (R2 custom domain or *.r2.dev). */
  R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER,
};
