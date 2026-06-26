#!/usr/bin/env tsx
/**
 * Phase 0 — companion chat thread qualitative audit
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   npm run phase0:chat-audit
 *
 * Optional:
 *   PHASE0_OUT=reports/phase0
 *   PHASE0_THREAD_LIMIT=20
 *   PHASE0_MESSAGES_PER_THREAD=80
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { loadLocalEnv } from './load-local-env';
import { adminSupabaseRest } from '../src/lib/virtual-girlfriend/phase0/admin-rest';

loadLocalEnv(path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..'));
import {
  aggregateThreadAudits,
  auditThread,
  type ThreadMessage,
} from '../src/lib/virtual-girlfriend/phase0/chat-thread-audit';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.resolve(ROOT, process.env.PHASE0_OUT ?? 'reports/phase0');
const THREAD_LIMIT = Number(process.env.PHASE0_THREAD_LIMIT ?? 20);
const MESSAGES_PER_THREAD = Number(process.env.PHASE0_MESSAGES_PER_THREAD ?? 80);

type ConversationRow = {
  id: string;
  user_id: string;
  companion_id: string;
  updated_at: string;
};

type CompanionRow = {
  id: string;
  name: string;
};

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type: string | null;
  attachments: ThreadMessage['attachments'];
  created_at: string;
};

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log('Phase 0 — chat thread audit');
  console.log('Output:', OUT_DIR);
  console.log('');

  const conversations = await adminSupabaseRest<ConversationRow[]>('ai_conversations', {
    searchParams: new URLSearchParams({
      select: 'id,user_id,companion_id,updated_at',
      order: 'updated_at.desc',
      limit: String(THREAD_LIMIT),
    }),
  });

  const companionIds = [...new Set((conversations ?? []).map((row) => row.companion_id))];
  const companions = companionIds.length
    ? await adminSupabaseRest<CompanionRow[]>('ai_companions', {
        searchParams: new URLSearchParams({
          select: 'id,name',
          id: `in.(${companionIds.join(',')})`,
        }),
      })
    : [];
  const companionNameById = new Map((companions ?? []).map((row) => [row.id, row.name]));

  const audits = [];
  for (const conversation of conversations ?? []) {
    const messages = await adminSupabaseRest<MessageRow[]>('ai_messages', {
      searchParams: new URLSearchParams({
        select: 'id,role,content,content_type,attachments,created_at',
        conversation_id: `eq.${conversation.id}`,
        order: 'created_at.asc',
        limit: String(MESSAGES_PER_THREAD),
      }),
    });

    const threadMessages: ThreadMessage[] = (messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      content_type: message.content_type,
      attachments: message.attachments,
      created_at: message.created_at,
    }));

    const audit = auditThread(threadMessages);
    audits.push({
      conversationId: conversation.id,
      companionId: conversation.companion_id,
      companionName: companionNameById.get(conversation.companion_id) ?? 'unknown',
      userId: conversation.user_id,
      updatedAt: conversation.updated_at,
      audit,
    });

    process.stdout.write(
      `→ ${companionNameById.get(conversation.companion_id) ?? conversation.companion_id} `
      + `(${audit.messageCount} msgs, health ${audit.healthScore}) ... `,
    );
    console.log(Object.entries(audit.byType).map(([k, v]) => `${k}:${v}`).join(', ') || 'clean');
  }

  const summary = aggregateThreadAudits(
    audits.map((row) => ({
      companionId: row.companionId,
      companionName: row.companionName,
      audit: row.audit,
    })),
  );

  const report = {
    ranAt: new Date().toISOString(),
    threadLimit: THREAD_LIMIT,
    summary,
    threads: audits,
  };

  const reportPath = path.join(OUT_DIR, 'chat-thread-audit.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log('\n=== SUMMARY ===\n');
  console.log('Threads audited:     ', summary.threadCount);
  console.log('Avg health score:    ', summary.avgHealthScore);
  console.log('Finding totals:      ', summary.totals);
  console.log('\nWorst threads:');
  for (const row of summary.worstThreads) {
    console.log(`  - ${row.companionName}: health ${row.audit.healthScore}`, row.audit.byType);
  }
  console.log(`\nReport: ${path.relative(ROOT, reportPath)}\n`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});