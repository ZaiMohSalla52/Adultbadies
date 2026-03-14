export const REPORT_CATEGORIES = [
  'harassment',
  'spam',
  'impersonation',
  'explicit_content',
  'underage',
  'other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type BlockRecord = {
  blocker_id: string;
  blocked_user_id: string;
};

export type ReportRecord = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  match_id: string | null;
  message_id: string | null;
  category: ReportCategory;
  details: string | null;
};
