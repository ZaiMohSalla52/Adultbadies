import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { isValidDateOfBirth, submitAgeAttestation } from '@/lib/safety/age';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { dateOfBirth?: string; consent?: boolean };
  const dateOfBirth = String(body.dateOfBirth ?? '').trim();
  const consent = body.consent === true;

  if (!dateOfBirth || !isValidDateOfBirth(dateOfBirth)) {
    return NextResponse.json({ error: 'Enter a valid date of birth.' }, { status: 400 });
  }

  if (!consent) {
    return NextResponse.json({ error: 'You must confirm you consent to adult content.' }, { status: 400 });
  }

  try {
    const verification = await submitAgeAttestation(auth.accessToken, { dateOfBirth, consent });

    if (verification.status !== 'verified') {
      return NextResponse.json(
        { error: 'You must be at least 18 years old to use this service.', status: verification.status },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, status: verification.status });
  } catch (error) {
    console.error('[safety] age attestation failed', error);
    return NextResponse.json({ error: 'Unable to verify age right now. Please try again.' }, { status: 500 });
  }
}
