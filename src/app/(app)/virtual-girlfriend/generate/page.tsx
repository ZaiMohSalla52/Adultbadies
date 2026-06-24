import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getActiveVirtualGirlfriend,
  getVirtualGirlfriendCompanionById,
} from '@/lib/virtual-girlfriend/data';
import { claimPointStipend, getPointBalance } from '@/lib/points/data';
import { POINTS } from '@/lib/points/constants';
import { GeneratePhotoStudio } from '@/components/virtual-girlfriend/generate-photo-studio';

export default async function VirtualGirlfriendGeneratePhotoPage({
  searchParams,
}: {
  searchParams: Promise<{ companionId?: string }>;
}) {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const requestedCompanionId = params.companionId;

  const companion = requestedCompanionId
    ? await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
    : await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);

  if (!companion?.setup_completed) {
    redirect('/virtual-girlfriend/setup');
  }

  const entitlements = await getUserEntitlements(auth.accessToken, auth.user.id);
  if (entitlements.isPremium) {
    await claimPointStipend(auth.accessToken);
  }
  const pointBalance = await getPointBalance(auth.accessToken, auth.user.id);

  return (
    <GeneratePhotoStudio
      companionId={companion.id}
      companionName={companion.name}
      pointBalance={pointBalance}
      unblurCost={POINTS.unblurCost}
      isPremium={entitlements.isPremium}
    />
  );
}