import { cache } from 'react';
import { cookies } from 'next/headers';
import { getUserFromAccessToken } from '@/lib/supabase/jwt';

const tryParseAccessToken = (raw: string): string | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed === 'string') return parsed;

    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return parsed[0];
    }

    if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
      const token = (parsed as { access_token?: unknown }).access_token;
      return typeof token === 'string' ? token : null;
    }
  } catch {
    return raw;
  }

  return null;
};

export const getAccessTokenFromCookies = async (): Promise<string | null> => {
  const cookieStore = await cookies();

  const directToken = cookieStore.get('sb-access-token')?.value;
  const parsedDirect = directToken ? tryParseAccessToken(directToken) : null;
  if (parsedDirect) return parsedDirect;

  const authCookie = cookieStore
    .getAll()
    .find((cookie: { name: string }) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));

  if (!authCookie?.value) return null;
  return tryParseAccessToken(authCookie.value);
};

export const getAuthenticatedUser = cache(async () => {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return { user: null, accessToken: null };
  }

  const user = getUserFromAccessToken(accessToken);
  if (!user) {
    return { user: null, accessToken: null };
  }

  return { user, accessToken };
});
