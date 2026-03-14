export type MatchRecord = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: 'active' | 'unmatched' | 'blocked';
  created_at: string;
  updated_at: string;
};

export type MessageRecord = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

export type ProfilePreview = {
  id: string;
  full_name: string | null;
};

export type MatchListItem = {
  matchId: string;
  otherUserId: string;
  otherUserName: string;
  matchCreatedAt: string;
  lastMessageBody: string | null;
  lastMessageAt: string;
};

export type Conversation = {
  match: MatchRecord;
  otherUser: ProfilePreview;
  messages: MessageRecord[];
};
