import { NextRequest } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { requireEntitledFeature } from '@/lib/subscriptions/guards';
import {
  getActiveVirtualGirlfriend,
  getOrCreateVirtualGirlfriendUserStyleProfile,
  getVirtualGirlfriendCompanionById,
  retrieveRelevantVirtualGirlfriendMemories,
} from '@/lib/virtual-girlfriend/data';
import { createVirtualGirlfriendRealtimeSession } from '@/lib/virtual-girlfriend/voice';

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

    const [styleProfile, memories] = await Promise.all([
      getOrCreateVirtualGirlfriendUserStyleProfile(auth.accessToken, auth.user.id, companion.id),
      retrieveRelevantVirtualGirlfriendMemories(auth.accessToken, {
        userId: auth.user.id,
        companionId: companion.id,
        queryText: String(body.previewUtterance ?? '').trim() || `voice session with ${companion.name}`,
        maxItems: 8,
      }),
    ]);

    const session = await createVirtualGirlfriendRealtimeSession({
      companion,
      memories,
      styleProfile,
    });

    if (!session.clientSecret) {
      return json({ error: 'Voice session could not be initialized at the moment. Please try again shortly.' }, 502);
    }

    return json({
      session: {
        id: session.sessionId,
        clientSecret: session.clientSecret,
        expiresAt: session.expiresAt,
        model: session.model,
        companion: {
          id: companion.id,
          name: companion.name,
        },
        memoryCount: memories.length,
        styleAdaptationStrength: styleProfile.adaptation_strength,
      },
    });
  } catch (error) {
    console.error('[virtual-girlfriend] voice session init failed', error);
    return json({ error: 'Voice service is temporarily unavailable. Please try again shortly.' }, 502);
  }
}
