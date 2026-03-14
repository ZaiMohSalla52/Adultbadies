import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { supabaseRest } from '@/lib/supabase/rest';

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as {
    min_age?: number;
    max_age?: number;
    interested_in?: string;
    max_distance_km?: number | null;
  };

  const minAge = Number(body.min_age);
  const maxAge = Number(body.max_age);

  if (Number.isNaN(minAge) || Number.isNaN(maxAge) || minAge < 18 || maxAge < minAge) {
    return NextResponse.json({ error: 'Please provide a valid age range.' }, { status: 400 });
  }

  const payload = {
    user_id: auth.user.id,
    min_age: minAge,
    max_age: maxAge,
    interested_in: body.interested_in ?? null,
    max_distance_km: typeof body.max_distance_km === 'number' ? body.max_distance_km : null,
  };

  try {
    const rows = await supabaseRest('dating_preferences', auth.accessToken, {
      method: 'POST',
      body: payload,
      prefer: 'resolution=merge-duplicates,return=representation',
    });

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save preferences' },
      { status: 500 },
    );
  }
}
