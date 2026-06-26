import { containsForbiddenReplyLanguage } from '@/lib/virtual-girlfriend/reply-sanitizer';
import { looksLikePhotoRequest } from '@/lib/virtual-girlfriend/photo-request';

export type ThreadMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type?: string | null;
  attachments?: Array<{ kind?: string; imageUrl?: string; source?: string }> | null;
  created_at?: string;
};

export type ThreadAuditFinding = {
  messageId: string;
  type: 'refusal_leak' | 'meta_action_leak' | 'photo_mismatch' | 'forgetfulness' | 'short_reply';
  severity: 'low' | 'medium' | 'high';
  detail: string;
  excerpt: string;
};

const FORGETFULNESS_PATTERNS: Array<{ pattern: RegExp; needsPriorUserFact: RegExp; label: string }> = [
  {
    pattern: /what do you do(?: for (?:work|a living))?/i,
    needsPriorUserFact: /\b(work|job|career|office|engineer|developer|designer|teacher|nurse|lawyer|student)\b/i,
    label: 're-asked occupation',
  },
  {
    pattern: /what(?:'s| is) your name/i,
    needsPriorUserFact: /\b(my name is|i'?m called|call me)\b/i,
    label: 're-asked user name',
  },
  {
    pattern: /where do you live/i,
    needsPriorUserFact: /\b(i live in|from [A-Z][a-z]+|moved to)\b/i,
    label: 're-asked location',
  },
  {
    pattern: /how old are you/i,
    needsPriorUserFact: /\b(i'?m \d{2}|age \d{2}|years old)\b/i,
    label: 're-asked age',
  },
];

const META_ACTION_PATTERN = /\*(?:sends?|uploading|attaching|photosending|smirks?)[^*]*\*/i;

const priorUserText = (messages: ThreadMessage[], index: number) =>
  messages
    .slice(0, index)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');

const hasImageAttachment = (message: ThreadMessage) =>
  message.content_type === 'mixed'
  || (Array.isArray(message.attachments) && message.attachments.some((item) => item.kind === 'image' || item.imageUrl));

export const auditThreadMessage = (
  messages: ThreadMessage[],
  index: number,
): ThreadAuditFinding[] => {
  const message = messages[index];
  if (!message || message.role !== 'assistant') return [];

  const findings: ThreadAuditFinding[] = [];
  const excerpt = message.content.slice(0, 180);

  if (containsForbiddenReplyLanguage(message.content)) {
    findings.push({
      messageId: message.id,
      type: 'refusal_leak',
      severity: 'high',
      detail: 'Assistant reply matches forbidden refusal/meta patterns.',
      excerpt,
    });
  }

  if (META_ACTION_PATTERN.test(message.content)) {
    findings.push({
      messageId: message.id,
      type: 'meta_action_leak',
      severity: 'medium',
      detail: 'Assistant used meta action narration (*sends photo*, etc.).',
      excerpt,
    });
  }

  if (message.content.trim().length > 0 && message.content.trim().length < 18) {
    findings.push({
      messageId: message.id,
      type: 'short_reply',
      severity: 'low',
      detail: 'Very short assistant reply — may feel low-effort.',
      excerpt,
    });
  }

  const priorUsers = priorUserText(messages, index);
  for (const rule of FORGETFULNESS_PATTERNS) {
    if (rule.pattern.test(message.content) && rule.needsPriorUserFact.test(priorUsers)) {
      findings.push({
        messageId: message.id,
        type: 'forgetfulness',
        severity: 'medium',
        detail: `Possible memory gap: ${rule.label}.`,
        excerpt,
      });
      break;
    }
  }

  const previousUser = [...messages.slice(0, index)].reverse().find((item) => item.role === 'user');
  if (
    previousUser
    && looksLikePhotoRequest(previousUser.content)
    && !hasImageAttachment(message)
    && !/\b(later|soon|not yet|tease|wait)\b/i.test(message.content)
  ) {
    findings.push({
      messageId: message.id,
      type: 'photo_mismatch',
      severity: 'high',
      detail: 'User requested a photo but assistant message has no image attachment.',
      excerpt,
    });
  }

  return findings;
};

export const auditThread = (messages: ThreadMessage[]) => {
  const sorted = [...messages].sort((left, right) => {
    const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
    const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
    return leftTime - rightTime;
  });

  const findings = sorted.flatMap((_, index) => auditThreadMessage(sorted, index));
  const byType = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.type] = (acc[finding.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    messageCount: sorted.length,
    assistantCount: sorted.filter((message) => message.role === 'assistant').length,
    findings,
    byType,
    healthScore: Math.max(0, 100 - findings.filter((f) => f.severity === 'high').length * 12 - findings.filter((f) => f.severity === 'medium').length * 5),
  };
};

export type ThreadAuditSummary = ReturnType<typeof auditThread>;

export const aggregateThreadAudits = (audits: Array<{ companionId: string; companionName: string; audit: ThreadAuditSummary }>) => {
  const totals = audits.reduce<Record<string, number>>((acc, row) => {
    for (const [type, count] of Object.entries(row.audit.byType)) {
      acc[type] = (acc[type] ?? 0) + count;
    }
    return acc;
  }, {});

  const avgHealth = audits.length
    ? audits.reduce((sum, row) => sum + row.audit.healthScore, 0) / audits.length
    : 0;

  return {
    threadCount: audits.length,
    totals,
    avgHealthScore: Number(avgHealth.toFixed(1)),
    worstThreads: [...audits]
      .sort((left, right) => left.audit.healthScore - right.audit.healthScore)
      .slice(0, 5),
  };
};