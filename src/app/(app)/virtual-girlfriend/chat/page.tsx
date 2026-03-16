import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getActiveVirtualGirlfriend,
  getOrCreateVirtualGirlfriendConversation,
  getVirtualGirlfriendMessages,
  getVirtualGirlfriendUserMessageCountForToday,
} from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendChatClient } from '@/components/virtual-girlfriend/chat-client';

export default async function VirtualGirlfriendChatPage() {
  const auth = await getAuthenticatedUser();

  if (!auth.user || !auth.accessToken) {
    redirect('/sign-in');
  }

  const companion = await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);
  if (!companion?.setup_completed) {
    redirect('/virtual-girlfriend/setup');
  }

  const [conversation, entitlements, usedToday] = await Promise.all([
    getOrCreateVirtualGirlfriendConversation(auth.accessToken, auth.user.id, companion.id),
    getUserEntitlements(auth.accessToken, auth.user.id),
    getVirtualGirlfriendUserMessageCountForToday(auth.accessToken, auth.user.id),
  ]);

  const messages = await getVirtualGirlfriendMessages(auth.accessToken, conversation.id);

  return (
    <VirtualGirlfriendChatClient
      companionName={companion.name}
      disclosureLabel={companion.disclosure_label}
      initialMessages={messages}
      entitlements={entitlements}
      usedToday={usedToday}
    />
  );
}
