import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/api/onboarding/shared';
import { getVirtualGirlfriendMessageById } from '@/lib/virtual-girlfriend/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const messageId = String(request.nextUrl.searchParams.get('messageId') ?? '').trim();
  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required.' }, { status: 400 });
  }

  try {
    const message = await getVirtualGirlfriendMessageById(
      auth.accessToken,
      messageId,
      auth.user.id,
    );

    if (!message) {
      return NextResponse.json({ attachment: null }, { status: 404 });
    }

    const attachment = message.attachments?.find((entry) => entry.kind === 'image') ?? null;
    return NextResponse.json({
      attachment,
      contentType: message.content_type,
    });
  } catch (error) {
    console.error('[virtual-girlfriend] message attachment poll failed', error);
    return NextResponse.json({ error: 'Unable to load message attachment.' }, { status: 500 });
  }
}