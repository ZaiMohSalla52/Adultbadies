import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { isAdminReviewerEmail } from '@/lib/auth/admin';
import {
  listPendingCanonicalReviewVisualProfiles,
  setCanonicalReviewDecisionForVisualProfile,
} from '@/lib/virtual-girlfriend/data';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  if (!isAdminReviewerEmail(auth.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pending = await listPendingCanonicalReviewVisualProfiles(auth.accessToken);
  return NextResponse.json({ pending });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  if (!isAdminReviewerEmail(auth.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as {
    visualProfileId?: string;
    decision?: 'approved' | 'rejected';
    reviewNotes?: string;
  };

  const visualProfileId = body.visualProfileId?.trim();
  if (!visualProfileId) {
    return NextResponse.json({ error: 'Missing visualProfileId.' }, { status: 400 });
  }

  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    return NextResponse.json({ error: 'Decision must be approved or rejected.' }, { status: 400 });
  }

  const updated = await setCanonicalReviewDecisionForVisualProfile(auth.accessToken, {
    visualProfileId,
    decision: body.decision,
    reviewedBy: auth.user.id,
    reviewNotes: body.reviewNotes,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Visual profile not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, visualProfile: updated });
}
