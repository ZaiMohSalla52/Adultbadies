'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { AuthActionState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type AuthFormProps = {
  mode: 'sign-in' | 'sign-up';
  action: (prevState: AuthActionState, formData: FormData) => Promise<AuthActionState>;
};

const initialState: AuthActionState = {};

const SubmitButton = ({ mode }: { mode: AuthFormProps['mode'] }) => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
    </Button>
  );
};

export const AuthForm = ({ mode, action }: AuthFormProps) => {
  const [state, formAction] = useActionState(action, initialState);
  const isSignIn = mode === 'sign-in';

  return (
    <Card className="max-w-md">
      <h1 className="mt-0 mb-2 text-lg font-semibold">{isSignIn ? 'Sign in' : 'Create your account'}</h1>
      <p className="mb-6 text-sm text-muted">
        {isSignIn
          ? 'Welcome back. Sign in to continue to your dashboard.'
          : 'Use email and password to create your account.'}
      </p>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <Input type="email" name="email" placeholder="Email" autoComplete="email" required />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete={isSignIn ? 'current-password' : 'new-password'}
          minLength={8}
          required
        />
        {state.error ? <p className="m-0 text-sm text-red-400">{state.error}</p> : null}
        <SubmitButton mode={mode} />
      </form>
      <p className="mb-0 mt-4 text-sm text-muted">
        {isSignIn ? "Don't have an account? " : 'Already have an account? '}
        <Link className="text-brand hover:underline" href={isSignIn ? '/sign-up' : '/sign-in'}>
          {isSignIn ? 'Create one' : 'Sign in'}
        </Link>
      </p>
    </Card>
  );
};
