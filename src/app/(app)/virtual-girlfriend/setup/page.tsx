import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getActiveVirtualGirlfriend } from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendSetupFlow } from '@/components/virtual-girlfriend/setup-flow';

export default async function VirtualGirlfriendSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const createNew = params.new === '1';
  const companion = await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);

  if (!createNew && companion?.setup_completed) {
    redirect('/virtual-girlfriend/profile');
  }

  return <VirtualGirlfriendSetupFlow createNew={createNew} />;
}
