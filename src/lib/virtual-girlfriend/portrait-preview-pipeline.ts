import type { VirtualGirlfriendPortraitPreviewCandidate } from '@/lib/virtual-girlfriend/image-machine';
import { runPortraitPreviewImageMachine } from '@/lib/virtual-girlfriend/image-machine';
import {
  deliverPortraitPreviewCandidates,
  filterReachablePortraitPreviewCandidates,
} from '@/lib/virtual-girlfriend/portrait-preview-delivery';
import type { PreviewTraits } from '@/lib/virtual-girlfriend/types/traits';

export type PortraitPreviewPipelineInput = PreviewTraits & {
  userId: string;
  count?: number;
};

export type PortraitPreviewPipelineOutcome = {
  ok: boolean;
  candidates: VirtualGirlfriendPortraitPreviewCandidate[];
  stages: {
    generated: number;
    delivered: number;
    hosted: number;
    reachable: number;
    returned: number;
  };
  error?: string;
};

const isHostedPreviewUrl = (value: string) => /^https?:\/\//i.test(value.trim());
const isDataUrlPreview = (value: string) => /^data:image\//i.test(value.trim());

/**
 * End-to-end portrait preview pipeline shared by the API route and integration tests.
 * Prefers durable hosted URLs, but falls back to provider URLs or data URLs rather than failing.
 */
export const runPortraitPreviewPipeline = async (
  input: PortraitPreviewPipelineInput,
): Promise<PortraitPreviewPipelineOutcome> => {
  const result = await runPortraitPreviewImageMachine({
    kind: 'portrait_preview',
    userId: input.userId,
    ...input,
    count: input.count ?? 3,
  });

  const generated = result.candidates;
  const delivered = await deliverPortraitPreviewCandidates(generated, input.userId);
  const pool = delivered.length > 0 ? delivered : generated;

  const hosted = pool.filter((candidate) => isHostedPreviewUrl(candidate.imageDataUrl));
  let reachableCount = 0;
  let candidates: VirtualGirlfriendPortraitPreviewCandidate[] = [];

  if (hosted.length > 0) {
    const reachable = await filterReachablePortraitPreviewCandidates(hosted);
    reachableCount = reachable.length;
    // Reachability probes can be flaky from serverless (Range unsupported, cold CDN).
    // Prefer reachable URLs, but keep hosted URLs we just generated/published.
    candidates = reachable.length > 0 ? reachable : hosted;
  }

  if (candidates.length < 1) {
    candidates = pool.filter((candidate) => isDataUrlPreview(candidate.imageDataUrl));
  }

  const returned = candidates.slice(0, input.count ?? 3);

  return {
    ok: returned.length > 0,
    candidates: returned,
    stages: {
      generated: generated.length,
      delivered: delivered.length,
      hosted: hosted.length,
      reachable: reachableCount,
      returned: returned.length,
    },
  };
};