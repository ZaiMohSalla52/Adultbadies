import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

const parseAdminReviewerEmails = () =>
  (env.ADMIN_REVIEWER_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isAdminReviewerEmail = (email?: string | null) => {
  if (!email) return false;
  const allowList = parseAdminReviewerEmails();
  if (allowList.length === 0) return false;
  return allowList.includes(email.trim().toLowerCase());
};

export const requireAdminReviewer = async () => {
  const { user, accessToken } = await getAuthenticatedUser();

  if (!user || !accessToken) {
    redirect('/sign-in');
  }

  if (!isAdminReviewerEmail(user.email)) {
    redirect('/dashboard');
  }

  return { user, accessToken };
};
