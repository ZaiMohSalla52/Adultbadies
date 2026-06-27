import { NextRequest, NextResponse } from 'next/server';
import { seedCatalogCompanions } from '@/lib/virtual-girlfriend/catalog/seed';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

  const maxParam = request.nextUrl.searchParams.get('max');
  const maxToCreate = maxParam ? Number(maxParam) : 1;

  try {
    const result = await seedCatalogCompanions({
      maxToCreate: Number.isFinite(maxToCreate) ? maxToCreate : 1,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[cron][catalog-seed] failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'catalog_seed_failed' },
      { status: 500 },
    );
  }
}