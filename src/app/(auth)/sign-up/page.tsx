import { AuthForm } from '@/components/auth/auth-form';
import { signUpAction } from '@/app/(auth)/actions';

export default function SignUpPage() {
  return <AuthForm mode="sign-up" action={signUpAction} />;
}
