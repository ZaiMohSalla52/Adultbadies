import { env } from '@/lib/env';

export type AdminRestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  searchParams?: URLSearchParams;
  prefer?: string;
};

export const requireServiceRoleKey = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for Phase 0 baseline scripts. Add it to .env.local.',
    );
  }
  return key;
};

const resolveSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('example.supabase.co')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is required for Phase 0 baseline scripts. Add it to .env.local.',
    );
  }
  return url;
};

export const adminSupabaseRest = async <T>(
  path: string,
  options?: AdminRestOptions,
): Promise<T> => {
  const key = requireServiceRoleKey();
  const query = options?.searchParams?.toString();
  const url = `${resolveSupabaseUrl()}/rest/v1/${path}${query ? `?${query}` : ''}`;
  const method = options?.method ?? 'GET';

  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options?.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Admin REST failed (${response.status}) on ${path}: ${message.slice(0, 300)}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  if (!raw.trim()) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
};