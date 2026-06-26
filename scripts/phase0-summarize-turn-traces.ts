#!/usr/bin/env tsx
/**
 * Summarize JSONL turn traces produced by VG_TURN_TRACE_ENABLED.
 *
 * Usage:
 *   npm run phase0:trace-summary
 *   VG_TURN_TRACE_PATH=logs/vg-turn-traces.jsonl npm run phase0:trace-summary
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveTurnTracePath } from '../src/lib/virtual-girlfriend/phase0/turn-trace';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.resolve(ROOT, process.env.PHASE0_OUT ?? 'reports/phase0');

type TraceRow = {
  traceId: string;
  recordedAt: string;
  llm: { model: string | null; ok: boolean };
  timingsMs: { total?: number; llm?: number; image?: number };
  image: { outcome: string; source: string | null; expectedRoute?: { provider: string; modelKind: string } };
  memory: { retrievedCount: number };
  flags: string[];
};

const main = async () => {
  const tracePath = resolveTurnTracePath();
  let raw = '';
  try {
    raw = await fs.readFile(tracePath, 'utf8');
  } catch {
    console.error(`No trace file at ${tracePath}. Enable VG_TURN_TRACE_ENABLED=1 and run chat turns first.`);
    process.exit(1);
  }

  const rows = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceRow);

  const totals = {
    traces: rows.length,
    llmFailures: rows.filter((row) => !row.llm.ok).length,
    imageGenerated: rows.filter((row) => row.image.outcome === 'generated_new').length,
    imageFailed: rows.filter((row) => row.image.outcome === 'failed_generation').length,
    photoMismatchFlags: rows.filter((row) => row.flags.includes('photo_requested_without_attachment')).length,
    refusalFlags: rows.filter((row) => row.flags.includes('forbidden_language_in_final_reply')).length,
  };

  const avg = (values: number[]) =>
    values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;

  const summary = {
    ranAt: new Date().toISOString(),
    tracePath,
    totals,
    averagesMs: {
      total: avg(rows.map((row) => row.timingsMs.total ?? 0).filter(Boolean)),
      llm: avg(rows.map((row) => row.timingsMs.llm ?? 0).filter(Boolean)),
      image: avg(rows.map((row) => row.timingsMs.image ?? 0).filter(Boolean)),
    },
    routes: rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.image.expectedRoute
        ? `${row.image.expectedRoute.provider}/${row.image.expectedRoute.modelKind}`
        : 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    memoryHits: {
      avgRetrieved: avg(rows.map((row) => row.memory.retrievedCount)),
      zeroMemoryTurns: rows.filter((row) => row.memory.retrievedCount === 0).length,
    },
    recent: rows.slice(-10),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const reportPath = path.join(OUT_DIR, 'turn-trace-summary.json');
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));

  console.log('Phase 0 — turn trace summary');
  console.log('Traces:', totals.traces);
  console.log('Avg total/llm/image ms:', summary.averagesMs);
  console.log('Routes:', summary.routes);
  console.log('Flags — photo mismatch:', totals.photoMismatchFlags, 'refusal:', totals.refusalFlags);
  console.log(`Report: ${path.relative(ROOT, reportPath)}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});