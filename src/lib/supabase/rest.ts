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
  const requestMethod = options?.method ?? 'GET';
  const response = await fetch(buildUrl(path, options?.searchParams), {
    method: requestMethod,
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

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch (error) {
    console.error('Failed to parse Supabase REST JSON response.', {
      path,
      method: requestMethod,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bodyPreview: rawBody.slice(0, 200),
    });
    throw error;
  }
};
