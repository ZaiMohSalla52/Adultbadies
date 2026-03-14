import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const getCurrentUser = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
};

export const requireAuthenticatedUser = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return user!;
};

export const redirectAuthenticatedUser = async (destination = '/dashboard') => {
  const user = await getCurrentUser();

  if (user) {
    redirect(destination);
  }
};
