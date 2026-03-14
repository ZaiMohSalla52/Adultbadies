import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { env } from '@/lib/env';
import { supabaseRest } from '@/lib/supabase/rest';
import type { ProfilePhotoRecord } from '@/lib/onboarding/types';

const PHOTO_BUCKET = 'profile-photos';

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get('photo');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Photo file is required.' }, { status: 400 });
  }

  const currentPhotos = await supabaseRest<ProfilePhotoRecord[]>('profile_photos', auth.accessToken, {
    searchParams: new URLSearchParams({ select: 'id', user_id: `eq.${auth.user.id}` }),
  });

  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${auth.user.id}/${Date.now()}-${randomUUID()}.${extension}`;

  const upload = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: await file.arrayBuffer(),
  });

  if (!upload.ok) {
    const message = await upload.text();
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }

  const inserted = await supabaseRest<ProfilePhotoRecord[]>('profile_photos', auth.accessToken, {
    method: 'POST',
    body: {
      user_id: auth.user.id,
      storage_path: path,
      is_primary: currentPhotos.length === 0,
      sort_order: currentPhotos.length,
    },
    prefer: 'return=representation',
  });

  return NextResponse.json(inserted[0]);
}
