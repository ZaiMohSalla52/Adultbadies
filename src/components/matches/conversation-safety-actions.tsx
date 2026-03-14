'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { REPORT_CATEGORIES, type ReportCategory } from '@/lib/safety/types';

type ConversationSafetyActionsProps = {
  otherUserId: string;
  matchId: string;
};

export const ConversationSafetyActions = ({ otherUserId, matchId }: ConversationSafetyActionsProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment');
  const [reportDetails, setReportDetails] = useState('');

  const blockUser = () => {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch('/api/safety/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: otherUserId, reason: 'blocked_from_match_chat' }),
      });

      if (!response.ok) {
        setFeedback('Unable to block this user right now.');
        return;
      }

      setFeedback('User blocked. This conversation will no longer be available.');
      router.push('/matches');
      router.refresh();
    });
  };

  const reportUser = () => {
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch('/api/safety/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: otherUserId,
          matchId,
          category: reportCategory,
          details: reportDetails,
        }),
      });

      if (!response.ok) {
        setFeedback('Unable to submit report right now.');
        return;
      }

      setFeedback('Report submitted. Thank you.');
      setReportDetails('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <p className="my-0 text-sm font-medium">Safety options</p>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="ghost" disabled={isPending} onClick={blockUser}>
          Block user
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={reportUser}>
          Report user
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted" htmlFor="conversation-report-category">
          Report category
        </label>
        <select
          id="conversation-report-category"
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
          value={reportCategory}
          onChange={(event) => setReportCategory(event.target.value as ReportCategory)}
          disabled={isPending}
        >
          {REPORT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <Textarea
        value={reportDetails}
        onChange={(event) => setReportDetails(event.target.value)}
        maxLength={1000}
        placeholder="Optional details"
        disabled={isPending}
      />

      {feedback ? <p className="my-0 text-sm text-brand">{feedback}</p> : null}
    </div>
  );
};
