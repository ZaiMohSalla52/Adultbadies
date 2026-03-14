import { env } from '@/lib/env';

export const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
export const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type SupabaseAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
  };
};

export type SupabaseAuthResponse = {
  user?: {
    id: string;
    email?: string;
  };
  session?: SupabaseAuthSession;
};

const defaultHeaders = {
  apikey: supabaseAnonKey,
  'Content-Type': 'application/json',
};

export const callSupabaseAuth = async <T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> => {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `Auth request failed (${response.status})`;

    try {
      const error = (await response.json()) as { msg?: string; message?: string };
      message = error.message ?? error.msg ?? message;
    } catch {
      // noop
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
};
