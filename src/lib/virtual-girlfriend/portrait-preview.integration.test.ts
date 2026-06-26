import { describe, expect, it } from 'vitest';
import { isBrowserImageDeliveryConfigured } from '@/lib/storage/publish-browser-image';
import {
  findDistinctnessConflict,
  isCharacterDuplicateConflict,
} from '@/lib/virtual-girlfriend/distinctness';
import { resolveVgImageProvider } from '@/lib/virtual-girlfriend/image-provider-config';
import { resolveModelsLabPortraitModel } from '@/lib/virtual-girlfriend/modelslab-image-config';
import { isReachablePortraitPreviewUrl } from '@/lib/virtual-girlfriend/portrait-preview-delivery';
import { runPortraitPreviewPipeline } from '@/lib/virtual-girlfriend/portrait-preview-pipeline';
import { resolveSetupTraits } from '@/lib/virtual-girlfriend/setup-normalizer';
import type { VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';

const INTEGRATION = process.env.PORTRAIT_PREVIEW_INTEGRATION === '1';
const hasApiKey = Boolean(process.env.MODELSLAB_API_KEY?.trim());

const sampleTraits = () =>
  resolveSetupTraits({
    sex: 'female',
    origin: 'latina',
    hairColor: 'dark brown',
    hairLength: 'long',
    eyeColor: 'brown',
    skinTone: 'medium',
    bodyType: 'curvy',
    age: 24,
    styleVibe: 'seductive',
    personality: 'sultry_seductive',
    breastSize: 'large',
    occupation: 'model',
    freeformDetails: 'warm confident energy',
  });

const distinctProfile = (): VirtualGirlfriendStructuredProfile => ({
  schemaVersion: 1,
  name: `Audit ${Date.now()}`,
  sex: 'female',
  age: 24,
  origin: 'latina',
  hairColor: 'dark brown',
  hairLength: 'long',
  eyeColor: 'brown',
  skinTone: 'medium',
  styleVibe: 'seductive',
  figure: 'curvy',
  bodyType: 'curvy',
  breastSize: 'large',
  occupation: 'model',
  personality: 'sultry_seductive',
  sexuality: 'straight',
  freeformDetails: 'warm confident energy',
  archetype: 'siren',
  tone: 'flirty',
  affectionStyle: 'warm',
  visualAesthetic: 'glamorous',
  preferenceHints: null,
  selectedPortraitPrompt: null,
  selectedPortraitImage: null,
});

describe('distinctness-check contract', () => {
  it('returns ok:true for a distinct profile with no existing companions', () => {
    const conflict = findDistinctnessConflict({
      candidateProfile: distinctProfile(),
      existingCompanions: [],
    });

    const ok = !conflict || !isCharacterDuplicateConflict(conflict);
    expect(ok).toBe(true);
  });
});

describe.skipIf(!INTEGRATION || !hasApiKey)('portrait preview integration', () => {
  it('returns ok:true with reachable portrait candidates (full pipeline)', async () => {
    const outcome = await runPortraitPreviewPipeline({
      userId: 'integration-test-user',
      ...sampleTraits(),
      count: 3,
    });

    console.info('[portrait-preview-integration]', {
      ok: outcome.ok,
      stages: outcome.stages,
      provider: resolveVgImageProvider(),
      portraitModel: resolveModelsLabPortraitModel(),
      deliveryConfigured: isBrowserImageDeliveryConfigured(),
      sampleUrls: outcome.candidates.map((candidate) => candidate.imageDataUrl.slice(0, 96)),
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.stages.generated).toBeGreaterThanOrEqual(1);
    expect(outcome.stages.returned).toBeGreaterThanOrEqual(1);
    expect(outcome.candidates.length).toBeGreaterThanOrEqual(1);

    for (const candidate of outcome.candidates) {
      const url = candidate.imageDataUrl.trim();
      const reachable =
        /^data:image\//i.test(url) || (await isReachablePortraitPreviewUrl(url));
      expect(reachable).toBe(true);
    }
  }, 420_000);
});