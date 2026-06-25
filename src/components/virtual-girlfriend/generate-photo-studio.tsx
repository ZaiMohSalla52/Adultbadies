'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { VirtualGirlfriendMessageAttachment } from '@/lib/virtual-girlfriend/types';
import { getOutfitPresetsForSex, POSE_PRESETS } from '@/lib/virtual-girlfriend/outfit-presets';
import { ChatImageAttachment } from '@/components/virtual-girlfriend/chat-image-attachment';
import styles from './generate-photo-studio.module.css';

export const GeneratePhotoStudio = ({
  companionId,
  companionName,
  companionSex,
  pointBalance,
  unblurCost,
  isPremium,
}: {
  companionId: string;
  companionName: string;
  companionSex?: string | null;
  pointBalance: number;
  unblurCost: number;
  isPremium: boolean;
}) => {
  const outfitPresets = getOutfitPresetsForSex(companionSex);
  const [prompt, setPrompt] = useState('');
  const [selectedPose, setSelectedPose] = useState<string>(POSE_PRESETS[0].id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<VirtualGirlfriendMessageAttachment | null>(null);
  const [balance, setBalance] = useState(pointBalance);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);

  const buildPrompt = (base: string) => {
    const pose = POSE_PRESETS.find((entry) => entry.id === selectedPose);
    const poseHint = pose ? `, ${pose.hint}` : '';
    return `${base}${poseHint}. Same face and identity lock.`;
  };

  const generate = async (basePrompt: string) => {
    setPending(true);
    setError(null);
    setAttachment(null);

    try {
      const response = await fetch('/api/virtual-girlfriend/generate-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companionId,
          prompt: buildPrompt(basePrompt),
          category: 'outfit',
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        attachment?: VirtualGirlfriendMessageAttachment;
        error?: string;
      };

      if (!response.ok || !data.attachment) {
        setError(data.error ?? 'Generation failed. Try again.');
        return;
      }

      setAttachment(data.attachment);
      if (!data.attachment.locked) {
        setUnlockedIds((prev) => [...prev, data.attachment!.imageId]);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Photo studio</p>
          <h1 className={styles.title}>Dress {companionName}</h1>
          <p className={styles.subtitle}>Generate a new look with outfit and pose controls — same face, new wardrobe.</p>
        </div>
        <Link href={`/virtual-girlfriend/chat?companionId=${companionId}`} className={styles.backLink}>
          Back to chat
        </Link>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Quick looks</h2>
        <div className={styles.presetGrid}>
          {outfitPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={styles.presetCard}
              disabled={pending}
              onClick={() => void generate(preset.sceneHint)}
            >
              <span className={styles.presetIcon}>{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Pose</h2>
        <div className={styles.poseRow}>
          {POSE_PRESETS.map((pose) => (
            <button
              key={pose.id}
              type="button"
              className={`${styles.poseChip} ${selectedPose === pose.id ? styles.poseChipActive : ''}`}
              onClick={() => setSelectedPose(pose.id)}
            >
              {pose.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Custom prompt</h2>
        <textarea
          className={styles.promptInput}
          rows={4}
          placeholder={`Describe ${companionName}'s outfit, setting, and vibe…`}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="button"
          className={styles.generateButton}
          disabled={pending || !prompt.trim()}
          onClick={() => void generate(prompt.trim())}
        >
          {pending ? 'Generating…' : 'Generate photo'}
        </button>
        {!isPremium ? (
          <p className={styles.hint}>Free accounts receive blurred previews — unblur with 💜 {unblurCost} points each.</p>
        ) : null}
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      {attachment ? (
        <section className={styles.resultPanel}>
          <h2 className={styles.sectionTitle}>Result</h2>
          <div className={styles.resultFrame}>
            <ChatImageAttachment
              attachment={attachment}
              companionName={companionName}
              initialUnlocked={unlockedIds.includes(attachment.imageId)}
              balance={balance}
              unblurCost={unblurCost}
              isPremium={isPremium}
              onUnlocked={(imageId, nextBalance) => {
                setBalance(nextBalance);
                setUnlockedIds((prev) => [...prev, imageId]);
                setAttachment((prev) => (prev ? { ...prev, locked: false } : prev));
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
};