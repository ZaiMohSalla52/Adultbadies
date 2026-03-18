/*
 * CompanionTraits — future canonical trait schema for all image surfaces.
 * This is a normalized image-generation trait contract.
 * It is additive in this phase and must not break current runtime contracts.
 *
 * Rules:
 * - Do not put UI-only fields here
 * - Do not put provider/storage fields here
 * - Do not put preview-only or route-only fields here
 * - This is for image identity + prompt-builder inputs
 */

export type Sex = 'male' | 'female';

export type Origin = 'asian' | 'latina' | 'black' | 'white' | 'mixed' | 'middle_eastern' | 'south_asian';

export type HairLength = 'short' | 'medium' | 'long';

export type BodyType = 'slim' | 'athletic' | 'curvy' | 'petite';

export interface CompanionTraits {
  sex: Sex;
  age: number;
  origin: Origin;
  hairColor: string;
  hairLength: HairLength;
  eyeColor: string;
  bodyType: BodyType;

  // Optional identity lock enrichments, set after canonical lock
  identityAnchors?: string[];
  identityInvariants?: string[];
  cameraPrefs?: string[];
}

export type PreviewTraits = Pick<
  CompanionTraits,
  'sex' | 'age' | 'origin' | 'hairColor' | 'hairLength' | 'eyeColor' | 'bodyType'
>;

export type CanonicalTraits = CompanionTraits;

const VALID_SEX: ReadonlySet<Sex> = new Set(['male', 'female']);
const VALID_ORIGINS: ReadonlySet<Origin> = new Set([
  'asian',
  'latina',
  'black',
  'white',
  'mixed',
  'middle_eastern',
  'south_asian',
]);
const VALID_BODY_TYPES: ReadonlySet<BodyType> = new Set(['slim', 'athletic', 'curvy', 'petite']);
const VALID_HAIR_LENGTHS: ReadonlySet<HairLength> = new Set(['short', 'medium', 'long']);

export function isValidSex(value: string): value is Sex {
  return VALID_SEX.has(value as Sex);
}

export function isValidOrigin(value: string): value is Origin {
  return VALID_ORIGINS.has(value as Origin);
}

export function isValidBodyType(value: string): value is BodyType {
  return VALID_BODY_TYPES.has(value as BodyType);
}

export function isValidHairLength(value: string): value is HairLength {
  return VALID_HAIR_LENGTHS.has(value as HairLength);
}
