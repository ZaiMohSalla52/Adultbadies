/*
 * normalizeToCompanionTraits — future normalized bridge from setup-style raw input
 * into CompanionTraits.
 *
 * This is additive in this phase.
 * Do NOT replace existing runtime setup normalization yet.
 */

import {
  type BodyType,
  type CompanionTraits,
  type HairLength,
  type Origin,
  type Sex,
  isValidBodyType,
  isValidHairLength,
  isValidOrigin,
  isValidSex,
} from './traits';

export interface RawSetupTraits {
  sex?: string;
  age?: number | string;
  origin?: string;
  hairColor?: string;
  hairLength?: string;
  eyeColor?: string;
  figure?: string;
  bodyType?: string;
}

const clampAge = (value: number): number => Math.min(99, Math.max(18, value));

const normalizeString = (value: string | undefined): string => value?.trim().toLowerCase() ?? '';

const normalizeSex = (sex: string | undefined): Sex => {
  const normalized = normalizeString(sex);
  if (!isValidSex(normalized)) {
    throw new Error(`Invalid sex "${sex ?? ''}". Expected one of: male, female.`);
  }
  return normalized;
};

const normalizeOrigin = (origin: string | undefined): Origin => {
  const normalized = normalizeString(origin);
  if (!normalized) return 'white';
  if (!isValidOrigin(normalized)) {
    throw new Error(
      `Invalid origin "${origin ?? ''}". Expected one of: asian, latina, black, white, mixed, middle_eastern, south_asian.`
    );
  }
  return normalized;
};

const normalizeHairLength = (hairLength: string | undefined): HairLength => {
  const normalized = normalizeString(hairLength);
  if (!normalized) return 'medium';
  if (!isValidHairLength(normalized)) {
    throw new Error(`Invalid hairLength "${hairLength ?? ''}". Expected one of: short, medium, long.`);
  }
  return normalized;
};

const normalizeBodyType = (figure: string | undefined, bodyType: string | undefined): BodyType => {
  const normalized = normalizeString(figure) || normalizeString(bodyType);
  if (!normalized) return 'slim';
  if (!isValidBodyType(normalized)) {
    throw new Error(`Invalid bodyType/figure "${figure ?? bodyType ?? ''}". Expected one of: slim, athletic, curvy, petite.`);
  }
  return normalized;
};

const normalizeAge = (age: number | string | undefined): number => {
  if (age === undefined || age === null || age === '') return 25;
  const asNumber = typeof age === 'number' ? age : Number(age);
  if (Number.isNaN(asNumber) || !Number.isFinite(asNumber)) {
    throw new Error(`Invalid age "${String(age)}". Expected a numeric value.`);
  }
  return clampAge(Math.round(asNumber));
};

export function normalizeToCompanionTraits(raw: RawSetupTraits): CompanionTraits {
  return {
    sex: normalizeSex(raw.sex),
    age: normalizeAge(raw.age),
    origin: normalizeOrigin(raw.origin),
    hairColor: normalizeString(raw.hairColor) || 'brown',
    hairLength: normalizeHairLength(raw.hairLength),
    eyeColor: normalizeString(raw.eyeColor) || 'brown',
    bodyType: normalizeBodyType(raw.figure, raw.bodyType),
  };
}
