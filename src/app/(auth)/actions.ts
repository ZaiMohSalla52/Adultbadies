'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AuthActionState = {
  error?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateCredentials = (formData: FormData) => {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!emailPattern.test(email)) {
    return { error: 'Please enter a valid email address.' } as const;
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' } as const;
  }

  return { email, password } as const;
};

export const signInAction = async (_prev: AuthActionState, formData: FormData): Promise<AuthActionState> => {
  const parsed = validateCredentials(formData);

  if ('error' in parsed) {
    return parsed;
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signInWithPassword(parsed.email, parsed.password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to sign in.' };
  }

  redirect('/dashboard');
  return {};
};

export const signUpAction = async (_prev: AuthActionState, formData: FormData): Promise<AuthActionState> => {
  const parsed = validateCredentials(formData);

  if ('error' in parsed) {
    return parsed;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.signUp(parsed.email, parsed.password);

    if (data.user?.id) {
      await supabase.from('profiles').upsert({ id: data.user.id });
    }

    if (!data.session) {
      return { error: 'Account created. Check your email to confirm your account, then sign in.' };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create account.' };
  }

  redirect('/dashboard');
  return {};
};

export const signOutAction = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
};
