import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnonKey, supabaseUrl, type SupabaseAuthSession } from '@/lib/supabase/shared';

const ACCESS_COOKIE = 'sb-access-token';
const REFRESH_COOKIE = 'sb-refresh-token';
const maxAge = 60 * 60 * 24 * 30;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
};

const createSupabaseHeaders = (accessToken?: string) => ({
  apikey: supabaseAnonKey,
  'Content-Type': 'application/json',
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

const isAccessTokenValid = async (accessToken: string): Promise<boolean> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: createSupabaseHeaders(accessToken),
    cache: 'no-store',
  });

  return response.ok;
};

const refreshSession = async (refreshToken: string): Promise<SupabaseAuthSession | null> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: createSupabaseHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SupabaseAuthSession;
};

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken || !refreshToken) {
    return NextResponse.next();
  }

  if (await isAccessTokenValid(accessToken)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const refreshedSession = await refreshSession(refreshToken);

  if (!refreshedSession) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  response.cookies.set(ACCESS_COOKIE, refreshedSession.access_token, cookieOptions);
  response.cookies.set(REFRESH_COOKIE, refreshedSession.refresh_token, cookieOptions);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
