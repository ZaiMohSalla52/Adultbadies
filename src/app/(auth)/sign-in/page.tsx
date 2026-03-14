import { AuthForm } from '@/components/auth/auth-form';
import { signInAction } from '@/app/(auth)/actions';

export default function SignInPage() {
  return <AuthForm mode="sign-in" action={signInAction} />;
}
