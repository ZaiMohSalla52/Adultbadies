'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { AuthActionState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up';
  action: (prevState: AuthActionState, formData: FormData) => Promise<AuthActionState>;
};

const initialState: AuthActionState = {};

const SubmitButton = ({ mode }: { mode: AuthFormProps['mode'] }) => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="auth-submit">
      {pending ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
    </Button>
  );
};

export const AuthForm = ({ mode, action }: AuthFormProps) => {
  const [state, formAction] = useActionState(action, initialState);
  const isSignIn = mode === 'sign-in';

  return (
    <section className="auth-form-panel" aria-labelledby="auth-title">
      <p className="auth-form-eyebrow">Adult Badies Access</p>
      <h1 id="auth-title" className="auth-form-title">
        {isSignIn ? 'Welcome back' : 'Create your profile'}
      </h1>
      <p className="auth-form-copy">
        {isSignIn
          ? 'Sign in to continue your conversations and discover new matches.'
          : 'Join with email and password to start discovering people who match your energy.'}
      </p>

      <form action={formAction} className="auth-form-fields" noValidate>
        <label className="auth-form-label" htmlFor="auth-email">
          Email
        </label>
        <Input id="auth-email" type="email" name="email" placeholder="you@example.com" autoComplete="email" required />

        <label className="auth-form-label" htmlFor="auth-password">
          Password
        </label>
        <Input
          id="auth-password"
          type="password"
          name="password"
          placeholder={isSignIn ? 'Enter your password' : 'Create a secure password'}
          autoComplete={isSignIn ? 'current-password' : 'new-password'}
          minLength={8}
          required
        />

        {state.error ? <p className="auth-form-error">{state.error}</p> : null}
        <SubmitButton mode={mode} />
      </form>

      <p className="auth-form-switch">
        {isSignIn ? "Don't have an account? " : 'Already have an account? '}
        <Link className="auth-form-switch-link" href={isSignIn ? '/sign-up' : '/sign-in'}>
          {isSignIn ? 'Create one' : 'Sign in'}
        </Link>
      </p>
    </section>
  );
};
