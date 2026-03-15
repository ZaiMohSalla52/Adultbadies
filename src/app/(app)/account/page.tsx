import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

export default async function AccountPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  return (
    <div className="app-page-stack">
      <Card className="app-page-header account-header-card">
        <p className="chat-label">Account</p>
        <h1 className="my-0">Profile & settings</h1>
        <p className="my-0 text-muted">Manage your core account details and app setup progress.</p>
      </Card>

      <div className="app-grid-2">
        <Card className="app-surface-card account-detail-card">
          <h2 className="my-0 text-lg font-semibold">Account details</h2>
          <dl className="account-detail-list">
            <div>
              <dt>Email</dt>
              <dd>{auth.user.email ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd>{auth.user.id}</dd>
            </div>
          </dl>
        </Card>

        <Card className="app-surface-card account-actions-card">
          <h2 className="my-0 text-lg font-semibold">Quick actions</h2>
          <div className="account-quick-actions">
            <Link href="/onboarding" className="ui-button ui-button-secondary">
              Review onboarding profile
            </Link>
            <Link href="/premium" className="ui-button ui-button-ghost">
              Manage premium plan details
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
