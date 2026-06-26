import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co').hostname;
  } catch {
    return 'example.supabase.co';
  }
})();

const r2PublicHost = (() => {
  try {
    return new URL(process.env.R2_PUBLIC_BASE_URL ?? '').hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Companion + gallery delivery via R2 public bucket (pub-*.r2.dev)
      { protocol: 'https', hostname: '**.r2.dev' },
      ...(r2PublicHost ? [{ protocol: 'https' as const, hostname: r2PublicHost }] : []),
      { protocol: 'https', hostname: 'assets.modelslab.ai' },
      { protocol: 'https', hostname: 'images.stablediffusionapi.com' },
      { protocol: 'https', hostname: supabaseHost },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;