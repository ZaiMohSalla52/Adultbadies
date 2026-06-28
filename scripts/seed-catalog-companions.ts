import path from 'node:path';

import { loadLocalEnv } from './load-local-env';

loadLocalEnv(path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..'));

const main = async () => {
  const { resumeCatalogCompanions, seedCatalogCompanions } = await import(
    '../src/lib/virtual-girlfriend/catalog/seed'
  );

  const maxArg = process.argv.find((arg) => arg.startsWith('--max='));
  const max = maxArg ? Number(maxArg.split('=')[1]) : undefined;
  const resume = process.argv.includes('--resume');

  const result = resume
    ? await resumeCatalogCompanions({
        maxToResume: Number.isFinite(max) ? max : undefined,
      })
    : await seedCatalogCompanions({
        maxToCreate: Number.isFinite(max) ? max : undefined,
      });

  console.info('[catalog-seed] complete', result);
  if (!result.ok) process.exitCode = 1;
};

void main();