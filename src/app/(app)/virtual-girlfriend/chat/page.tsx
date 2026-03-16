import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getActiveVirtualGirlfriend,
  getOrCreateVirtualGirlfriendConversation,
  getOrCreateVirtualGirlfriendUserStyleProfile,
  getVirtualGirlfriendCompanionById,
  getVirtualGirlfriendMessages,
  getVirtualGirlfriendUserMessageCountForToday,
  setActiveVirtualGirlfriend,
} from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendChatClient } from '@/components/virtual-girlfriend/chat-client';
import { processDueVirtualGirlfriendProactiveEvents } from '@/lib/virtual-girlfriend/proactive';

export default async function VirtualGirlfriendChatPage({
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

  await processDueVirtualGirlfriendProactiveEvents({
    token: auth.accessToken,
    userId: auth.user.id,
    companion,
  });

  const [conversation, entitlements, usedToday, styleProfile] = await Promise.all([
    getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
    getVirtualGirlfriendUserMessageCountForToday(auth.accessToken, auth.user.id),
    getOrCreateVirtualGirlfriendUserStyleProfile(auth.accessToken, auth.user.id, companion.id),
  ]);

  const messages = await getVirtualGirlfriendMessages(auth.accessToken, conversation.id);

  return (
    <VirtualGirlfriendChatClient
      companionId={companion.id}
      companionName={companion.name}
      disclosureLabel={companion.disclosure_label}
      initialMessages={messages}
      entitlements={entitlements}
      usedToday={usedToday}
      initialStyleProfile={styleProfile}
      isPremium={entitlements.isPremium}
    />
  );
}
