import { describe, expect, it } from 'vitest';
import {
  buildBootstrapIdentityPack,
  resolveCanonicalReferenceForChat,
  resolveChatVisualContext,
} from '@/lib/virtual-girlfriend/chat-image-bootstrap';
import type {
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendVisualProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const companion = {
  id: 'companion-1',
  name: 'Susy',
  visual_aesthetic: 'warm casual',
  structured_profile: {
    name: 'Susy',
    age: '26',
    origin: 'latina',
    hairColor: 'dark brown',
    hairLength: 'long',
    eyeColor: 'brown',
    skinTone: 'medium',
    bodyType: 'curvy',
    archetype: 'girl next door',
    tone: 'warm',
    affectionStyle: 'playful',
    visualAesthetic: 'warm casual',
  },
} as VirtualGirlfriendCompanionRecord;

const image = (overrides: Partial<VirtualGirlfriendCompanionImageRecord>): VirtualGirlfriendCompanionImageRecord => ({
  id: 'image-1',
  user_id: 'user-1',
  companion_id: 'companion-1',
  visual_profile_id: 'profile-1',
  image_kind: 'canonical',
  variant_index: 0,
  origin_storage_provider: 'r2',
  origin_storage_key: 'key',
  origin_mime_type: 'image/png',
  origin_byte_size: 1000,
  delivery_provider: 'cloudinary',
  delivery_public_id: 'public',
  delivery_url: 'https://cdn.example.com/canonical.png',
  width: 768,
  height: 1024,
  prompt_hash: 'hash-1',
  style_version: 'vg-image-v3',
  seed_metadata: {},
  lineage_metadata: {},
  moderation_status: 'approved',
  moderation: {},
  provenance: {},
  quality_score: 0.9,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const visualProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  companion_id: 'companion-1',
  profile_version: 'v1',
  style_version: 'vg-image-v3',
  prompt_hash: 'profile-hash',
  source_setup: {},
  identity_pack: {
    continuityAnchors: ['dark brown long hair'],
    coreLookDescriptors: ['latina features'],
    portraitFramingStyle: 'portrait',
    wardrobeDirection: 'casual',
    lightingMoodDirection: 'warm',
    realismPolishLevel: 'realistic',
    identityInvariants: {
      ageBand: '24-28',
      faceShape: 'oval',
      eyeShapeColor: 'brown eyes',
      browCharacter: 'defined brows',
      noseProfile: 'natural nose',
      lipShape: 'full lips',
      skinToneBand: 'medium',
      hairSignature: 'dark brown long hair',
      bodyPresentation: 'curvy figure',
      signatureAccessoryOrMotif: 'stud earrings',
    },
    cameraCompositionPreferences: ['waist-up'],
    negativeConstraints: [],
    negativeOverlapCues: [],
  },
  canonical_reference_image_id: null,
  canonical_reference_metadata: {},
  canonical_review_status: 'approved',
  reviewed_by: null,
  reviewed_at: null,
  review_notes: null,
  continuity_notes: null,
  moderation_status: 'approved',
  provenance: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as VirtualGirlfriendVisualProfileRecord;

describe('chat image bootstrap', () => {
  it('builds a usable identity pack from companion structured profile', () => {
    const pack = buildBootstrapIdentityPack(companion);
    expect(pack.continuityAnchors.join(' ')).toContain('dark brown');
    expect(pack.identityInvariants.bodyPresentation).toContain('curvy');
  });

  it('resolves canonical from gallery when canonical_reference_image_id is missing', () => {
    const canonical = image({ id: 'canonical-1', image_kind: 'canonical' });
    const resolved = resolveCanonicalReferenceForChat(visualProfile, [canonical]);
    expect(resolved?.id).toBe('canonical-1');
  });

  it('bootstraps visual context when visual profile row is missing but images exist', () => {
    const canonical = image({ id: 'canonical-1' });
    const context = resolveChatVisualContext({
      companion,
      visualProfile: null,
      existingImages: [canonical],
    });

    expect(context).not.toBeNull();
    expect(context?.visualProfileId).toBe('profile-1');
    expect(context?.bootstrapped).toBe(true);
    expect(context?.identityPack.continuityAnchors.length).toBeGreaterThan(0);
  });

  it('returns null when there is no visual profile and no usable images', () => {
    const context = resolveChatVisualContext({
      companion,
      visualProfile: null,
      existingImages: [],
    });
    expect(context).toBeNull();
  });
});