import { NextRequest, NextResponse } from 'next/server';
import { processGlobalDueProactiveEvents } from '@/lib/virtual-girlfriend/proactive';

export const runtime = 'nodejs';
export const maxDuration = 120;

const authorizeCron = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get('authorization')?.trim();
  return header === `Bearer ${secret}`;
};

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processGlobalDueProactiveEvents({ limit: 12 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron][virtual-girlfriend][proactive] failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'proactive_cron_failed' },
      { status: 500 },
    );
  }
}