import { cookies } from 'next/headers';
import {
  callSupabaseAuth,
  type SupabaseAuthResponse,
  type SupabaseAuthSession,
} from '@/lib/supabase/shared';
import type { SupabaseUser } from '@/lib/supabase/types';

const ACCESS_COOKIE = 'sb-access-token';
const REFRESH_COOKIE = 'sb-refresh-token';
const maxAge = 60 * 60 * 24 * 30;

const getStoredTokens = async () => {
  const cookieStore = await cookies();

  return {
    accessToken: cookieStore.get(ACCESS_COOKIE)?.value,
    refreshToken: cookieStore.get(REFRESH_COOKIE)?.value,
  };
};

const persistSession = async (session: SupabaseAuthSession) => {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });

  cookieStore.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
};

const clearSession = async () => {
  const cookieStore = await cookies();

  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
};

const refreshAccessToken = async (refreshToken: string) => {
  const session = await callSupabaseAuth<SupabaseAuthSession>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  await persistSession(session);

  return session;
};

export const createSupabaseServerClient = async () => {
  return {
    auth: {
      signInWithPassword: async (email: string, password: string) => {
        const data = await callSupabaseAuth<SupabaseAuthSession>('/auth/v1/token?grant_type=password', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        await persistSession(data);

        return { data: { user: data.user }, error: null };
      },
      signUp: async (email: string, password: string) => {
        const data = await callSupabaseAuth<SupabaseAuthResponse>('/auth/v1/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (data.session) {
          await persistSession(data.session);
        }

        return { data, error: null };
      },
      signOut: async () => {
        const { accessToken } = await getStoredTokens();

        try {
          if (accessToken) {
            await callSupabaseAuth('/auth/v1/logout', {
              method: 'POST',
              accessToken,
              body: JSON.stringify({ scope: 'local' }),
            });
          }
        } catch {
          // noop
        }

        await clearSession();

        return { error: null };
      },
      getUser: async (): Promise<{ data: { user: SupabaseUser | null } }> => {
        const { accessToken, refreshToken } = await getStoredTokens();

        if (!accessToken) {
          return { data: { user: null } };
        }

        try {
          const user = await callSupabaseAuth<SupabaseUser>('/auth/v1/user', {
            method: 'GET',
            accessToken,
            headers: { 'Content-Type': 'application/json' },
          });

          return { data: { user } };
        } catch {
          if (!refreshToken) {
            await clearSession();
            return { data: { user: null } };
          }

          try {
            const refreshed = await refreshAccessToken(refreshToken);
            return { data: { user: refreshed.user } };
          } catch {
            await clearSession();
            return { data: { user: null } };
          }
        }
      },
    },
    from: (table: string) => ({
      upsert: async (payload: Record<string, unknown>) => {
        const { accessToken } = await getStoredTokens();

        if (!accessToken) {
          return { error: new Error('Missing access token') };
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=id`,
          {
            method: 'POST',
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          return { error: new Error('Failed to upsert row') };
        }

        return { error: null };
      },
    }),
  };
};
