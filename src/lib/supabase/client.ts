'use client';

import { callSupabaseAuth, type SupabaseAuthResponse } from '@/lib/supabase/shared';

export const createSupabaseBrowserClient = () => ({
  signInWithPassword: async (email: string, password: string) =>
    callSupabaseAuth<SupabaseAuthResponse>('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
});
