import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { supabaseRest } from '@/lib/supabase/rest';

type Params = { params: { photoId: string } };

export async function PATCH(_request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { photoId } = params;

  await supabaseRest('profile_photos', auth.accessToken, {
    method: 'PATCH',
    body: { is_primary: false },
    searchParams: new URLSearchParams({ user_id: `eq.${auth.user.id}` }),
  });

  await supabaseRest('profile_photos', auth.accessToken, {
    method: 'PATCH',
    body: { is_primary: true },
    searchParams: new URLSearchParams({ id: `eq.${photoId}`, user_id: `eq.${auth.user.id}` }),
  });

  return NextResponse.json({ ok: true });
}
