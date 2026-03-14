import { NextResponse } from 'next/server';
import { isOnboardingComplete } from '@/lib/onboarding/completeness';
import { getOnboardingSnapshot } from '@/lib/onboarding/data';
import { requireAuth } from '@/app/api/onboarding/shared';
import { supabaseRest } from '@/lib/supabase/rest';

export async function POST() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const snapshot = await getOnboardingSnapshot(auth.accessToken, auth.user.id);

  if (!isOnboardingComplete(snapshot)) {
    return NextResponse.json(
      { error: 'Please complete all required fields and add at least one photo.' },
      { status: 400 },
    );
  }

  await supabaseRest('profiles', auth.accessToken, {
    method: 'PATCH',
    body: { onboarding_completed: true },
    searchParams: new URLSearchParams({ id: `eq.${auth.user.id}` }),
  });

  return NextResponse.json({ ok: true });
}
