import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseRest } from '@/lib/supabase/rest';
import { env } from '@/lib/env';

const AGE_VERIFIED_COOKIE = 'ab-age-verified';
const AGE_VERIFIED_MAX_AGE = 60 * 60 * 24;

export const AGE_OF_MAJORITY = 18;

export type AgeVerificationStatus = 'unverified' | 'verified' | 'rejected';

export type AgeVerification = {
  status: AgeVerificationStatus;
  verifiedAt: string | null;
  method: string | null;
};

type ProfileVerificationRow = {
  age_verification_status: AgeVerificationStatus | null;
  age_verified_at: string | null;
  age_verification_method: string | null;
};

/** Whole-year age from a YYYY-MM-DD date of birth. */
export const computeAge = (dateOfBirth: string, reference: Date = new Date()): number => {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return -1;

  let age = reference.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = reference.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && reference.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
};

export const isAdultDateOfBirth = (dateOfBirth: string): boolean =>
  computeAge(dateOfBirth) >= AGE_OF_MAJORITY;

export const isValidDateOfBirth = (dateOfBirth: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;
  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.getTime() > Date.now()) return false;
  // Reject implausible ages (>120y) to catch typos.
  return computeAge(dateOfBirth) <= 120;
};

export const getCachedAgeVerifiedUserId = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(AGE_VERIFIED_COOKIE)?.value ?? null;
};

export const AGE_VERIFIED_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: AGE_VERIFIED_MAX_AGE,
};

/** Route Handlers only — attach to NextResponse.cookies, not cookies() in layouts. */
export const applyAgeVerifiedCookie = (response: NextResponse, userId: string) => {
  response.cookies.set(AGE_VERIFIED_COOKIE, userId, AGE_VERIFIED_COOKIE_OPTIONS);
  return response;
};

/** Route Handlers only. */
export const clearAgeVerifiedCookie = (response: NextResponse) => {
  response.cookies.delete(AGE_VERIFIED_COOKIE);
  return response;
};

/** Read the caller's age-verification state from their own profile row. */
export const getAgeVerification = async (token: string, userId: string): Promise<AgeVerification> => {
  const rows = await supabaseRest<ProfileVerificationRow[]>('profiles', token, {
    searchParams: new URLSearchParams({
      select: 'age_verification_status,age_verified_at,age_verification_method',
      id: `eq.${userId}`,
      limit: '1',
    }),
  });

  const row = rows?.[0];
  return {
    status: row?.age_verification_status ?? 'unverified',
    verifiedAt: row?.age_verified_at ?? null,
    method: row?.age_verification_method ?? null,
  };
};

export const isAgeVerified = (verification: AgeVerification): boolean => verification.status === 'verified';

/**
 * Submit a self-attestation through the SECURITY DEFINER RPC. The database is
 * the source of truth: it recomputes age server-side and is the only path
 * allowed to write the verification columns.
 */
export const submitAgeAttestation = async (
  token: string,
  input: { dateOfBirth: string; consent: boolean },
): Promise<AgeVerification> => {
  const rows = await supabaseRest<ProfileVerificationRow[] | ProfileVerificationRow>(
    'rpc/submit_age_attestation',
    token,
    {
      method: 'POST',
      body: { p_date_of_birth: input.dateOfBirth, p_consent: input.consent },
      prefer: 'return=representation',
    },
  );

  const row = Array.isArray(rows) ? rows[0] : rows;
  return {
    status: row?.age_verification_status ?? 'unverified',
    verifiedAt: row?.age_verified_at ?? null,
    method: row?.age_verification_method ?? null,
  };
};

/**
 * Defense-in-depth guard for API routes that produce or expose adult content.
 * Returns a NextResponse to short-circuit when the caller is not 18+ verified,
 * or null to continue.
 */
export const requireAgeVerifiedApi = async (auth: {
  user: { id: string };
  accessToken: string;
}): Promise<NextResponse | null> => {
  // Allow disabling the gate only in non-production for local development.
  if (env.NEXT_PUBLIC_SUPABASE_URL.includes('example.supabase.co') && process.env.NODE_ENV !== 'production') {
    return null;
  }

  const cachedUserId = await getCachedAgeVerifiedUserId();
  if (cachedUserId === auth.user.id) return null;

  const verification = await getAgeVerification(auth.accessToken, auth.user.id);
  if (isAgeVerified(verification)) return null;

  return NextResponse.json(
    {
      error: 'Age verification required.',
      code: 'AGE_VERIFICATION_REQUIRED',
      verificationPath: '/age-verification',
    },
    { status: 403 },
  );
};
