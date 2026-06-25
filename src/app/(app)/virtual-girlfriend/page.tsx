import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { listVirtualGirlfriendCompanionsForGrid } from '@/lib/virtual-girlfriend/data';

export default async function AIGirlfriendPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const companions = await listVirtualGirlfriendCompanionsForGrid(auth.accessToken, auth.user.id);

  if (companions.length === 0) {
    redirect('/virtual-girlfriend/setup');
  }

  redirect('/discovery?tab=my');
}
