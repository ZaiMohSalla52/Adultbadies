import { NextResponse } from 'next/server';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { requireAuth } from '@/app/api/onboarding/shared';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const snapshot = await getOnboardingSnapshot(auth.accessToken, auth.user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load onboarding data' },
      { status: 500 },
    );
  }
}
