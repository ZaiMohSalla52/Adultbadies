#!/usr/bin/env tsx
/**
 * Creates (or finds) the dedicated auth user that owns catalog companion rows.
 *
 * Usage:
 *   npm run catalog:create-system-user
 *
 * Prints CATALOG_SYSTEM_USER_ID — add it to .env.local and Vercel.
 */

import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { loadLocalEnv } from './load-local-env';
import { requireServiceRoleKey } from '../src/lib/virtual-girlfriend/phase0/admin-rest';

const CATALOG_SYSTEM_EMAIL = 'catalog-system@adultbadies.internal';

loadLocalEnv(path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..'));

const resolveSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url || url.includes('example.supabase.co')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing in .env.local');
  }
  return url.replace(/\/$/, '');
};

const adminFetch = async (path: string, init?: RequestInit) => {
  const key = requireServiceRoleKey();
  const url = `${resolveSupabaseUrl()}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const raw = await response.text();
  let body: unknown = null;
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  if (!response.ok) {
    throw new Error(`Admin API ${path} failed (${response.status}): ${raw.slice(0, 400)}`);
  }

  return body;
};

const findCatalogSystemUser = async (): Promise<{ id: string; email: string } | null> => {
  const data = (await adminFetch('/auth/v1/admin/users?per_page=200')) as {
    users?: Array<{ id: string; email?: string | null }>;
  };

  const match = data.users?.find((user) => user.email?.toLowerCase() === CATALOG_SYSTEM_EMAIL);
  return match?.id ? { id: match.id, email: match.email ?? CATALOG_SYSTEM_EMAIL } : null;
};

const createCatalogSystemUser = async () => {
  const password = randomBytes(24).toString('base64url');
  const data = (await adminFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: CATALOG_SYSTEM_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Catalog System', role: 'catalog_owner' },
    }),
  })) as { id?: string; email?: string };

  if (!data.id) {
    throw new Error('Create user response did not include an id.');
  }

  return { id: data.id, email: data.email ?? CATALOG_SYSTEM_EMAIL, created: true as const };
};

const main = async () => {
  const existing = await findCatalogSystemUser();
  if (existing) {
    console.info('[catalog-system-user] already exists');
    console.info(`CATALOG_SYSTEM_USER_ID=${existing.id}`);
    console.info(`email=${existing.email}`);
    return;
  }

  const created = await createCatalogSystemUser();
  console.info('[catalog-system-user] created');
  console.info(`CATALOG_SYSTEM_USER_ID=${created.id}`);
  console.info(`email=${created.email}`);
  console.info('Add the line above to .env.local and Vercel env vars.');
  console.info('This account owns all catalog companions — not one user per companion.');
};

void main().catch((error) => {
  console.error('[catalog-system-user] failed', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});