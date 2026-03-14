import { env } from '@/lib/env';
import type { SupabaseClient } from '@/lib/supabase/types';

export const createSupabaseClientBase = (): SupabaseClient => ({
  restUrl: `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`,
  authHeader: (token) => ({
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  }),
});
