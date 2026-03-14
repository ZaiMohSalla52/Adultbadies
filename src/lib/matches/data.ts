import { supabaseRest } from '@/lib/supabase/rest';
import type { Conversation, MatchListItem, MatchRecord, MessageRecord, ProfilePreview } from '@/lib/matches/types';

const EMPTY_OTHER_USER: ProfilePreview = {
  id: '',
  full_name: null,
};

const getOtherUserId = (match: MatchRecord, userId: string) =>
  match.user_a_id === userId ? match.user_b_id : match.user_a_id;

const getProfilesByIds = async (token: string, userIds: string[]): Promise<Map<string, ProfilePreview>> => {
  if (userIds.length === 0) {
    return new Map();
  }

  const uniqueUserIds = Array.from(new Set(userIds));
  const query = new URLSearchParams({
    select: 'id,full_name',
    id: `in.(${uniqueUserIds.join(',')})`,
  });

  const rows = await supabaseRest<ProfilePreview[]>('profiles', token, { searchParams: query });
  return new Map(rows.map((profile) => [profile.id, profile]));
};

export const getMatchList = async (token: string, userId: string): Promise<MatchListItem[]> => {
  const matchesQuery = new URLSearchParams({
    select: 'id,user_a_id,user_b_id,status,created_at,updated_at',
    status: 'eq.active',
    or: `(user_a_id.eq.${userId},user_b_id.eq.${userId})`,
    order: 'updated_at.desc',
    limit: '100',
  });

  const matches = await supabaseRest<MatchRecord[]>('matches', token, { searchParams: matchesQuery });

  if (matches.length === 0) {
    return [];
  }

  const matchIds = matches.map((match) => match.id);
  const matchMessagesQuery = new URLSearchParams({
    select: 'id,match_id,sender_id,body,created_at,deleted_at',
    match_id: `in.(${matchIds.join(',')})`,
    deleted_at: 'is.null',
    order: 'created_at.desc',
    limit: '500',
  });

  const messages = await supabaseRest<MessageRecord[]>('messages', token, { searchParams: matchMessagesQuery });
  const latestMessageByMatch = new Map<string, MessageRecord>();

  messages.forEach((message) => {
    if (!latestMessageByMatch.has(message.match_id)) {
      latestMessageByMatch.set(message.match_id, message);
    }
  });

  const otherUserIds = matches.map((match) => getOtherUserId(match, userId));
  const profilesById = await getProfilesByIds(token, otherUserIds);

  return matches
    .map((match) => {
      const otherUserId = getOtherUserId(match, userId);
      const profile = profilesById.get(otherUserId) ?? { ...EMPTY_OTHER_USER, id: otherUserId };
      const latestMessage = latestMessageByMatch.get(match.id);
      const lastMessageAt = latestMessage?.created_at ?? match.created_at;

      return {
        matchId: match.id,
        otherUserId,
        otherUserName: profile.full_name ?? 'Unnamed user',
        matchCreatedAt: match.created_at,
        lastMessageBody: latestMessage?.body ?? null,
        lastMessageAt,
      };
    })
    .sort((a, b) => (a.lastMessageAt > b.lastMessageAt ? -1 : 1));
};

export const getConversation = async (
  token: string,
  userId: string,
  matchId: string,
): Promise<Conversation | null> => {
  const matchQuery = new URLSearchParams({
    select: 'id,user_a_id,user_b_id,status,created_at,updated_at',
    id: `eq.${matchId}`,
    status: 'eq.active',
    limit: '1',
  });

  const matchRows = await supabaseRest<MatchRecord[]>('matches', token, { searchParams: matchQuery });
  const match = matchRows[0] ?? null;

  if (!match) {
    return null;
  }

  const participantIds = [match.user_a_id, match.user_b_id];
  if (!participantIds.includes(userId)) {
    return null;
  }

  const otherUserId = getOtherUserId(match, userId);
  const profilesById = await getProfilesByIds(token, [otherUserId]);
  const otherUser = profilesById.get(otherUserId) ?? { ...EMPTY_OTHER_USER, id: otherUserId };

  const messageQuery = new URLSearchParams({
    select: 'id,match_id,sender_id,body,created_at,deleted_at',
    match_id: `eq.${match.id}`,
    deleted_at: 'is.null',
    order: 'created_at.asc',
    limit: '200',
  });

  const messages = await supabaseRest<MessageRecord[]>('messages', token, { searchParams: messageQuery });

  return {
    match,
    otherUser,
    messages,
  };
};

export const sendConversationMessage = async (
  token: string,
  userId: string,
  matchId: string,
  body: string,
): Promise<void> => {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error('Message body is required.');
  }

  if (trimmedBody.length > 2000) {
    throw new Error('Message body is too long.');
  }

  const conversation = await getConversation(token, userId, matchId);

  if (!conversation) {
    throw new Error('Conversation not found.');
  }

  await supabaseRest<MessageRecord[]>('messages', token, {
    method: 'POST',
    body: {
      match_id: matchId,
      sender_id: userId,
      body: trimmedBody,
    },
    prefer: 'return=minimal',
  });
};
