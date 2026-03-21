import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { supabaseRest } from '@/lib/supabase/rest';

type CompanionRow = {
  id: string;
  user_id: string;
  setup_completed: boolean;
  is_discoverable: boolean;
};

type ConversationRow = {
  id: string;
  companion_id: string;
  user_id: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await request.json()) as { companionId?: string };
  const companionId = String(body.companionId ?? '').trim();

  if (!companionId) {
    return NextResponse.json({ error: 'companionId is required.' }, { status: 400 });
  }

  // Verify companion exists, is discoverable, and is NOT owned by the current user
  const companions = await supabaseRest<CompanionRow[]>('ai_companions', auth.accessToken, {
    searchParams: new URLSearchParams({
      select: 'id,user_id,setup_completed,is_discoverable',
      id: `eq.${companionId}`,
      limit: '1',
    }),
  });

  const companion = companions[0] ?? null;

  if (!companion) {
    return NextResponse.json({ error: 'Companion not found.' }, { status: 404 });
  }

  if (companion.user_id === auth.user.id) {
    return NextResponse.json({ error: 'You cannot match with your own companion.' }, { status: 400 });
  }

  if (!companion.setup_completed || !companion.is_discoverable) {
    return NextResponse.json({ error: 'This companion is not available.' }, { status: 400 });
  }

  // Check if a conversation already exists
  const existing = await supabaseRest<ConversationRow[]>('ai_companion_conversations', auth.accessToken, {
    searchParams: new URLSearchParams({
      select: 'id,companion_id,user_id',
      companion_id: `eq.${companionId}`,
      user_id: `eq.${auth.user.id}`,
      limit: '1',
    }),
  });

  let conversationId: string;

  if (existing.length > 0) {
    conversationId = existing[0].id;
  } else {
    const created = await supabaseRest<ConversationRow[]>('ai_companion_conversations', auth.accessToken, {
      method: 'POST',
      body: {
        companion_id: companionId,
        user_id: auth.user.id,
      },
      prefer: 'return=representation',
    });

    if (!created[0]?.id) {
      return NextResponse.json({ error: 'Failed to create conversation.' }, { status: 500 });
    }

    conversationId = created[0].id;
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    companionId,
    conversationId,
    href: `/virtual-girlfriend/chat?companionId=${companionId}`,
  });
}
