import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getAgeVerification, isAgeVerified } from '@/lib/safety/age';
import { AgeGateForm } from './age-gate-form';

export const metadata = {
  title: 'Age verification — Adult Badies',
};

export default async function AgeVerificationPage() {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  const verification = await getAgeVerification(accessToken, user.id);
  if (isAgeVerified(verification)) {
    redirect('/dashboard');
  }

  return (
    <main className="auth-shell">
      <section className="auth-form-panel" aria-labelledby="age-gate-title">
        <p className="auth-form-eyebrow">Adults only · 18+</p>
        <h1 id="age-gate-title" className="auth-form-title">
          Verify your age
        </h1>
        <p className="auth-form-copy">
          Adult Badies contains adult content and is restricted to verified adults. Enter your date of
          birth to continue.
        </p>

        {verification.status === 'rejected' ? (
          <p className="auth-form-error">
            Access to this service is restricted to people aged 18 and over.
          </p>
        ) : null}

        <AgeGateForm />
      </section>
    </main>
  );
}
