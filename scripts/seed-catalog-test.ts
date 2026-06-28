#!/usr/bin/env tsx
/**
 * Seeds test catalog companions (see catalog/test-profiles.ts for current batch).
 *
 * Usage:
 *   npm run catalog:seed-test
 */

import path from 'node:path';

import { loadLocalEnv } from './load-local-env';

loadLocalEnv(path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..'));

const main = async () => {
  const { seedCatalogCompanions } = await import('../src/lib/virtual-girlfriend/catalog/seed');
  const { CATALOG_TEST_SEED_BLUEPRINTS } = await import('../src/lib/virtual-girlfriend/catalog/test-profiles');

  console.info('[catalog-seed-test] seeding', CATALOG_TEST_SEED_BLUEPRINTS.map((entry) => entry.key).join(', '));

  const result = await seedCatalogCompanions({
    blueprints: CATALOG_TEST_SEED_BLUEPRINTS,
    maxToCreate: CATALOG_TEST_SEED_BLUEPRINTS.length,
  });

  console.info('[catalog-seed-test] complete', result);
  if (!result.ok) process.exitCode = 1;
};

void main();