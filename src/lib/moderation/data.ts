import { env } from '@/lib/env';

type ModerationReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  category: string;
  status: string;
  created_at: string;
};

type ModerationLogRow = {
  id: string;
  report_id: string | null;
  action: string;
  created_at: string;
};

const fetchAdminRows = async <T>(path: string): Promise<T[]> => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Moderation query failed (${response.status}).`);
  }

  return (await response.json()) as T[];
};

export const getModerationQueueSnapshot = async () => {
  const [reports, logs] = await Promise.all([
    fetchAdminRows<ModerationReportRow>('reports?select=id,reporter_id,reported_user_id,category,status,created_at&status=in.(open,reviewing)&order=created_at.desc&limit=50'),
    fetchAdminRows<ModerationLogRow>('moderation_logs?select=id,report_id,action,created_at&order=created_at.desc&limit=50'),
  ]);

  return { reports, logs };
};
