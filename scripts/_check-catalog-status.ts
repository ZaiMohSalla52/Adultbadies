import path from 'node:path';

import { loadLocalEnv } from './load-local-env';
import { adminSupabaseRest } from '../src/lib/virtual-girlfriend/phase0/admin-rest';

loadLocalEnv(path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..'));

type Row = {
  name: string;
  source: string;
  generation_status: string;
  is_active: boolean;
  profile_tags: string[] | null;
};

const main = async () => {
  const rows = await adminSupabaseRest<Row[]>('ai_companions', {
    method: 'GET',
    searchParams: new URLSearchParams({
      select: 'name,source,generation_status,is_active,profile_tags',
      source: 'eq.catalog',
      order: 'created_at.asc',
    }),
  });

  console.info(`catalog companions: ${rows.length}`);
  for (const row of rows) {
    const key = row.profile_tags?.find((tag) => tag.startsWith('catalog_profile_key:')) ?? '?';
    console.info(`${row.name} | ${row.generation_status} | active=${row.is_active} | ${key}`);
  }
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});