import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { redirectAuthenticatedUser } from '@/lib/auth/server';

export default async function AuthLayout({ children }: PropsWithChildren) {
  await redirectAuthenticatedUser('/dashboard');

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link href="/home" className="marketing-brand" aria-label="Adult Badies home">
          <span className="marketing-brand-mark" aria-hidden>
            AB
          </span>
          <span>Adult Badies</span>
        </Link>
        <Link className="ui-button ui-button-ghost auth-header-link" href="/home">
          Back to home
        </Link>
      </header>

      <main className="auth-main">
        <section className="auth-intro" aria-hidden>
          <p className="marketing-kicker">Premium dating network</p>
          <h2>Meet with intention in a space designed for trust and chemistry.</h2>
          <p>
            Faster matches, cleaner conversations, and safety controls woven into every step of your experience.
          </p>
          <ul>
            <li>Smart intent-first discovery</li>
            <li>Conversation flow built for momentum</li>
            <li>Visible trust and safety controls</li>
          </ul>
        </section>

        <div className="auth-card-wrap">{children}</div>
      </main>
    </div>
  );
}
