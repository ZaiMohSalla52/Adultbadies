import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { env } from '@/lib/env';
import { supabaseRest } from '@/lib/supabase/rest';
import type { ProfilePhotoRecord } from '@/lib/onboarding/types';

const PHOTO_BUCKET = 'profile-photos';

type Params = { params: { photoId: string } };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { photoId } = params;

  const rows = await supabaseRest<ProfilePhotoRecord[]>('profile_photos', auth.accessToken, {
    searchParams: new URLSearchParams({ select: '*', id: `eq.${photoId}`, user_id: `eq.${auth.user.id}` }),
  });

  const photo = rows[0];

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${photo.storage_path}`, {
    method: 'DELETE',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
  });

  await supabaseRest('profile_photos', auth.accessToken, {
    method: 'DELETE',
    searchParams: new URLSearchParams({ id: `eq.${photoId}`, user_id: `eq.${auth.user.id}` }),
  });

  const remaining = await supabaseRest<ProfilePhotoRecord[]>('profile_photos', auth.accessToken, {
    searchParams: new URLSearchParams({ select: '*', user_id: `eq.${auth.user.id}`, order: 'sort_order.asc' }),
  });

  if (remaining.length > 0) {
    const primaryStillExists = remaining.some((item) => item.is_primary);

    if (!primaryStillExists) {
      await supabaseRest('profile_photos', auth.accessToken, {
        method: 'PATCH',
        body: { is_primary: true },
        searchParams: new URLSearchParams({ id: `eq.${remaining[0].id}`, user_id: `eq.${auth.user.id}` }),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
