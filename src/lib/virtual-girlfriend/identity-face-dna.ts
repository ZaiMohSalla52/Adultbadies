import crypto from 'node:crypto';

import type { VirtualGirlfriendVisualIdentityPack } from '@/lib/virtual-girlfriend/types';

const FACE_SHAPES = [
  'oval face with balanced proportions',
  'heart-shaped face with a soft tapered jaw',
  'angular face with sculpted cheekbones',
  'round face with gentle cheek fullness',
  'diamond face with a narrow chin and wide cheek line',
] as const;

const JAWLINE_TYPES = [
  'soft rounded jawline',
  'defined square jawline',
  'delicate V-shaped jawline',
  'strong tapered jawline',
] as const;

const NOSE_PROFILES = [
  'straight refined nose bridge',
  'slightly upturned nose tip',
  'narrow aquiline nose profile',
  'soft button nose with a narrow bridge',
] as const;

const LIP_SHAPES = [
  'full lips with a defined cupid bow',
  'medium lips with natural rose tint',
  'slightly fuller lower lip',
  'petite lips with crisp definition',
] as const;

const BROW_STYLES = [
  'arched brows with natural thickness',
  'straight soft brows',
  'bold structured brows',
  'feathered light brows',
] as const;

const CHEEKBONE_TYPES = [
  'high prominent cheekbones',
  'soft low cheekbones',
  'sculpted mid-cheek definition',
  'subtle natural cheek contour',
] as const;

const EYE_SPACING = [
  'average eye spacing with almond eye shape',
  'wide-set eyes with an open gaze',
  'close-set eyes with an intense gaze',
] as const;

export type FaceDnaInput = {
  userId?: string;
  companionId?: string;
  setupDraftKey?: string;
  sex: string;
  origin: string;
  age: number;
  hairColor: string;
  eyeColor: string;
  variantIndex?: number;
};

const pickFromPool = <T extends readonly string[]>(pool: T, seed: number, salt: number) =>
  pool[(seed + salt) % pool.length]!;

export const deriveFaceDnaSeed = (input: FaceDnaInput): number => {
  const fingerprint = JSON.stringify({
    userId: input.userId ?? 'anonymous',
    companionId: input.companionId ?? null,
    setupDraftKey: input.setupDraftKey ?? null,
    sex: input.sex,
    origin: input.origin,
    age: input.age,
    hairColor: input.hairColor,
    eyeColor: input.eyeColor,
    variantIndex: input.variantIndex ?? 0,
  });
  const hash = crypto.createHash('sha256').update(fingerprint).digest();
  return hash.readUInt32BE(0) % 2_147_483_647;
};

export const buildFaceDnaTokens = (input: FaceDnaInput): string[] => {
  const seed = deriveFaceDnaSeed(input);
  return [
    pickFromPool(FACE_SHAPES, seed, 1),
    pickFromPool(JAWLINE_TYPES, seed, 3),
    pickFromPool(NOSE_PROFILES, seed, 5),
    pickFromPool(LIP_SHAPES, seed, 7),
    pickFromPool(BROW_STYLES, seed, 11),
    pickFromPool(CHEEKBONE_TYPES, seed, 13),
    pickFromPool(EYE_SPACING, seed, 17),
  ];
};

export const formatFaceDnaLine = (tokens: string[]): string => {
  const unique = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)));
  if (!unique.length) return '';
  return `Distinct facial DNA: ${unique.join(', ')}.`;
};

export const buildFaceDnaLine = (input: FaceDnaInput): string =>
  formatFaceDnaLine(buildFaceDnaTokens(input));

export const formatNegativeOverlapLine = (cues: string[] | undefined): string | null => {
  const unique = Array.from(new Set((cues ?? []).map((cue) => cue.trim()).filter(Boolean))).slice(0, 8);
  if (!unique.length) return null;
  return `Avoid resembling existing companions: ${unique.join('; ')}.`;
};

export const collectSiblingDistinctnessCues = (
  identityPacks: Array<VirtualGirlfriendVisualIdentityPack | null | undefined>,
): string[] => {
  const cues: string[] = [];

  for (const pack of identityPacks) {
    if (!pack) continue;
    cues.push(...(pack.negativeOverlapCues ?? []));
    cues.push(...(pack.continuityAnchors ?? []).slice(0, 2));
    const invariants = Object.values(pack.identityInvariants ?? {})
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .slice(0, 2);
    cues.push(...invariants);
  }

  return Array.from(new Set(cues.map((cue) => cue.trim()).filter(Boolean))).slice(0, 12);
};