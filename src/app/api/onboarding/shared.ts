import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export const requireAuth = async () => {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { user, accessToken };
};
