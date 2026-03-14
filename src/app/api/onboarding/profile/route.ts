import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { supabaseRest } from '@/lib/supabase/rest';
import { isAgeValid } from '@/lib/onboarding/completeness';

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as {
    display_name?: string;
    bio?: string;
    birth_date?: string;
    gender?: string;
    interested_in?: string;
    location_text?: string;
  };

  if (body.birth_date && !isAgeValid(body.birth_date)) {
    return NextResponse.json({ error: 'You must be at least 18 years old.' }, { status: 400 });
  }

  const payload = {
    id: auth.user.id,
    display_name: body.display_name?.trim() ?? null,
    bio: body.bio?.trim() ?? null,
    birth_date: body.birth_date ?? null,
    gender: body.gender?.trim() ?? null,
    interested_in: body.interested_in?.trim() ?? null,
    location_text: body.location_text?.trim() ?? null,
  };

  try {
    const rows = await supabaseRest('profiles', auth.accessToken, {
      method: 'POST',
      body: payload,
      prefer: 'resolution=merge-duplicates,return=representation',
    });

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save profile' },
      { status: 500 },
    );
  }
}
