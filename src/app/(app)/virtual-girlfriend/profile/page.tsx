import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getActiveVirtualGirlfriend } from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendProfileView } from '@/components/virtual-girlfriend/profile-view';

export default async function VirtualGirlfriendProfilePage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const companion = await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);

  if (!companion?.setup_completed) {
    redirect('/virtual-girlfriend/setup');
  }

  return <VirtualGirlfriendProfileView companion={companion} />;
}
