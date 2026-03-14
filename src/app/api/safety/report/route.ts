import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { createReport } from '@/lib/safety/data';
import { REPORT_CATEGORIES, type ReportCategory } from '@/lib/safety/types';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as {
    reportedUserId?: string;
    matchId?: string;
    messageId?: string;
    category?: ReportCategory;
    details?: string;
  };

  const category = body.category;
  if (!category || !REPORT_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid report category.' }, { status: 400 });
  }

  try {
    const report = await createReport(auth.accessToken, auth.user.id, {
      reportedUserId: body.reportedUserId,
      matchId: body.matchId,
      messageId: body.messageId,
      category,
      details: body.details,
    });

    return NextResponse.json({ ok: true, reportId: report.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit report.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
