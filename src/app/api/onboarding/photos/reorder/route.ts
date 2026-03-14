import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { supabaseRest } from '@/lib/supabase/rest';

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { ids?: string[] };

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'Photo ids are required' }, { status: 400 });
  }

  await Promise.all(
    body.ids.map((id, index) =>
      supabaseRest('profile_photos', auth.accessToken, {
        method: 'PATCH',
        body: { sort_order: index },
        searchParams: new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${auth.user.id}` }),
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
