import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads `.env.local` into process.env for standalone tsx scripts.
 * Does not override variables already set in the shell.
 */
const loadEnvFile = (envPath: string) => {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

/** Loads `.env.local` then optional `.env.r2.local` (image delivery secrets). */
export const loadLocalEnv = (root = process.cwd()) => {
  loadEnvFile(path.join(root, '.env.local'));
  loadEnvFile(path.join(root, '.env.r2.local'));
};