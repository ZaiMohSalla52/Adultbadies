import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getActiveVirtualGirlfriend } from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendSetupFlow } from '@/components/virtual-girlfriend/setup-flow';

export default async function VirtualGirlfriendSetupPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const companion = await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);

  if (companion?.setup_completed) {
    redirect('/virtual-girlfriend/profile');
  }

  return <VirtualGirlfriendSetupFlow />;
}
