import { seedCatalogCompanions } from '../src/lib/virtual-girlfriend/catalog/seed';

const main = async () => {
  const maxArg = process.argv.find((arg) => arg.startsWith('--max='));
  const maxToCreate = maxArg ? Number(maxArg.split('=')[1]) : undefined;

  const result = await seedCatalogCompanions({
    maxToCreate: Number.isFinite(maxToCreate) ? maxToCreate : undefined,
  });

  console.info('[catalog-seed] complete', result);
  if (!result.ok) process.exitCode = 1;
};

void main();