import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireAgeVerifiedApi } from '@/lib/safety/age';
import { purgeCompanionImageStorage } from '@/lib/virtual-girlfriend/companion-deletion';
import {
  deleteVirtualGirlfriendCompanion,
  getVirtualGirlfriendCompanionById,
  isCatalogCompanion,
  getVirtualGirlfriendCompanionImages,
} from '@/lib/virtual-girlfriend/data';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const ageGate = await requireAgeVerifiedApi(auth);
  if (ageGate) return ageGate;

  let companionId = '';
  try {
    const body = (await request.json()) as { companionId?: string };
    companionId = String(body.companionId ?? '').trim();
  } catch {
    companionId = String(request.nextUrl.searchParams.get('companionId') ?? '').trim();
  }

  if (!companionId) {
    return NextResponse.json({ error: 'companionId is required.' }, { status: 400 });
  }

  const companion = await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, companionId);
  if (!companion) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  if (isCatalogCompanion(companion)) {
    return NextResponse.json({ error: 'Library companions cannot be deleted.' }, { status: 403 });
  }

  try {
    const images = await getVirtualGirlfriendCompanionImages(auth.accessToken, auth.user.id, companionId);
    await purgeCompanionImageStorage(images);

    const result = await deleteVirtualGirlfriendCompanion(auth.accessToken, companionId);

    const redirectTo = result.remaining_count > 0 ? '/virtual-girlfriend' : '/virtual-girlfriend/setup?new=1';

    return NextResponse.json({
      ok: true,
      companionId,
      promotedCompanionId: result.promoted_companion_id,
      remainingCount: result.remaining_count,
      redirectTo,
    });
  } catch (error) {
    console.error('[virtual-girlfriend] companion delete failed', { companionId, userId: auth.user.id, error });
    const message = error instanceof Error ? error.message : 'Unable to delete companion right now.';
    const notFound = /not found|P0002/i.test(message);
    const notReady = /delete_companion|function/i.test(message) && /does not exist|42883/i.test(message);
    return NextResponse.json(
      {
        error: notReady
          ? 'Companion deletion is not enabled on the database yet. Run migration 021_delete_companion.sql.'
          : notFound
            ? 'Companion not found.'
            : 'Unable to delete companion right now.',
      },
      { status: notReady ? 503 : notFound ? 404 : 500 },
    );
  }
}