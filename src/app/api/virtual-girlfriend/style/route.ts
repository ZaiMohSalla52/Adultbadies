import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { getUserEntitlements } from '@/lib/subscriptions/data';
import {
  getActiveVirtualGirlfriend,
  getOrCreateVirtualGirlfriendUserStyleProfile,
  getVirtualGirlfriendCompanionById,
} from '@/lib/virtual-girlfriend/data';
import { applyStyleControlPreset } from '@/lib/virtual-girlfriend/style-adaptation';
import {
  VIRTUAL_GIRLFRIEND_STYLE_CONTROL_PRESETS,
  type VirtualGirlfriendStyleControlPreset,
} from '@/lib/virtual-girlfriend/types';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const entitlements = await getUserEntitlements(auth.accessToken, auth.user.id);
  if (!entitlements.isPremium) {
    return NextResponse.json({ error: 'Style controls are available for Premium members.' }, { status: 402 });
  }

  const body = (await request.json()) as { preset?: string; companionId?: string };
  const requestedCompanionId = String(body.companionId ?? '').trim();

  const companion = requestedCompanionId
    ? await getVirtualGirlfriendCompanionById(auth.accessToken, auth.user.id, requestedCompanionId)
    : await getActiveVirtualGirlfriend(auth.accessToken, auth.user.id);
  if (!companion?.setup_completed) {
    return NextResponse.json({ error: 'Complete Virtual Girlfriend setup first.' }, { status: 400 });
  }

  const preset = body.preset as VirtualGirlfriendStyleControlPreset;

  if (!VIRTUAL_GIRLFRIEND_STYLE_CONTROL_PRESETS.includes(preset)) {
    return NextResponse.json({ error: 'Invalid style preset.' }, { status: 400 });
  }

  const profile = await getOrCreateVirtualGirlfriendUserStyleProfile(auth.accessToken, auth.user.id, companion.id);
  const updated = await applyStyleControlPreset({
    token: auth.accessToken,
    userId: auth.user.id,
    companionId: companion.id,
    current: profile,
    preset,
  });

  return NextResponse.json({ styleProfile: updated });
}
