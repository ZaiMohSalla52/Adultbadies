import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import {
  applyAgeVerifiedCookie,
  getAgeVerification,
  getCachedAgeVerifiedUserId,
  isAgeVerified,
} from '@/lib/safety/age';

/** Warm the age-verification cookie for already-verified users (Route Handler only). */
export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const cachedUserId = await getCachedAgeVerifiedUserId();
  if (cachedUserId === auth.user.id) {
    return NextResponse.json({ ok: true, cached: true });
  }

  const verification = await getAgeVerification(auth.accessToken, auth.user.id);
  if (!isAgeVerified(verification)) {
    return NextResponse.json({ error: 'Age verification required.' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, cached: false });
  return applyAgeVerifiedCookie(response, auth.user.id);
}