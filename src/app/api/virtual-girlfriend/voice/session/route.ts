import { NextRequest } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireEntitledFeature } from '@/lib/subscriptions/guards';
import {
  getActiveVirtualGirlfriend,
  getOrCreateVirtualGirlfriendUserStyleProfile,
  getVirtualGirlfriendCompanionById,
  retrieveRelevantVirtualGirlfriendMemories,
} from '@/lib/virtual-girlfriend/data';
import { VirtualGirlfriendVoiceUnavailableError } from '@/lib/virtual-girlfriend/voice';

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const entitlement = await requireEntitledFeature(auth.accessToken, auth.user.id, 'virtualGirlfriendVoice');
    if (!entitlement.allowed) {
      return json(
        {
          error: entitlement.reason ?? 'Virtual Girlfriend voice requires Premium.',
          code: 'VG_VOICE_PREMIUM_REQUIRED',
          upgradePath: '/premium',
        },
        402,
      );
    }

    const body = (await request.json().catch(() => ({}))) as { companionId?: string; previewUtterance?: string };
    const requestedCompanionId = String(body.companionId ?? '').trim();

    const requestedCompanion = requestedCompanionId
      ? await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
      : null;

    const companion = requestedCompanion ?? (await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id));

    if (!companion) {
      return json({ error: 'No companion selected. Start setup to unlock voice sessions.', code: 'VG_COMPANION_REQUIRED' }, 400);
    }

    if (!companion?.setup_completed) {
      return json({ error: 'Complete Virtual Girlfriend setup first.', code: 'VG_SETUP_REQUIRED' }, 400);
    }

    if (companion.generation_status !== 'ready') {
      return json(
        {
          error:
            companion.generation_status === 'failed'
              ? 'Voice is unavailable because this companion\'s image generation failed. Create or regenerate a ready companion first.'
              : 'Voice unlocks once this companion finishes generation.',
          code: 'VG_COMPANION_NOT_READY',
        },
        409,
      );
    }

    const [styleProfile, memories] = await Promise.all([
      getOrCreateVirtualGirlfriendUserStyleProfile(auth.accessToken, auth.user.id, companion.id),
      retrieveRelevantVirtualGirlfriendMemories(auth.accessToken, {
        userId: auth.user.id,
        companionId: companion.id,
        queryText: String(body.previewUtterance ?? '').trim() || `voice session with ${companion.name}`,
        maxItems: 8,
      }),
    ]);

    void memories;
    void styleProfile;

    throw new VirtualGirlfriendVoiceUnavailableError();
  } catch (error) {
    if (error instanceof VirtualGirlfriendVoiceUnavailableError) {
      return json(
        {
          error: error.message,
          code: error.code,
        },
        503,
      );
    }

    console.error('[virtual-girlfriend] voice session init failed', error);
    return json({ error: 'Voice service is temporarily unavailable. Please try again shortly.' }, 502);
  }
}
