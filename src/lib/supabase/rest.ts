import { env } from '@/lib/env';

const buildUrl = (path: string, searchParams?: URLSearchParams) => {
  const query = searchParams?.toString();
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}${query ? `?${query}` : ''}`;
};

export const supabaseRest = async <T>(
  path: string,
  token: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    searchParams?: URLSearchParams;
    prefer?: string;
  },
): Promise<T> => {
  const response = await fetch(buildUrl(path, options?.searchParams), {
    method: options?.method ?? 'GET',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase REST request failed (${response.status}): ${message}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};
