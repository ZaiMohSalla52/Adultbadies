/*
 * LockedCompanionIdentity — future explicit identity anchor for persisted image surfaces.
 * This is additive in Phase 3 and not yet wired into live generation flows.
 *
 * Rules:
 * - Preview does NOT use LockedCompanionIdentity
 * - Canonical/regenerate/gallery/chat will use it in later phases
 * - canonicalStorageUrl must be an owned storage URL, never provider temp URL
 */

import type { CompanionTraits } from './traits';
import type { SurfaceType } from './surfaces';

export interface LockedCompanionIdentity {
  companionId: string;
  traits: CompanionTraits;
  seedPrompt: string;
  promptVersion: string;
  surfaceType: SurfaceType;
  canonicalImageId: string;
  canonicalStorageUrl: string;
  canonicalDeliveryUrl: string;
  lockedAt: string;
}

export interface PreviewCandidate {
  imageDataUrl: string;
  prompt: string;
  promptVersion: string;
  variantIndex: number;
  label: string;
}

export interface PersistedImage {
  imageId: string;
  storageUrl: string;
  deliveryUrl: string;
  promptText: string;
  promptVersion: string;
  surfaceType: string;
  generatedAt: string;
}

export type MachineResult =
  | { outcome: 'success'; image: PersistedImage }
  | { outcome: 'partial_success'; image: PersistedImage; warning: string }
  | { outcome: 'failed'; reason: string }
  | { outcome: 'blocked_pre_gen'; reason: string };

export type PreviewMachineResult =
  | { outcome: 'success'; candidates: PreviewCandidate[] }
  | { outcome: 'partial'; candidates: PreviewCandidate[]; failedCount: number }
  | { outcome: 'failed'; reason: string };
