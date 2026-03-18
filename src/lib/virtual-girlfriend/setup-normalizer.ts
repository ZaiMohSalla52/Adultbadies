import type { BodyType, HairLength, Origin, PreviewTraits, Sex } from '@/lib/virtual-girlfriend/types/traits';
import { isValidBodyType, isValidHairLength, isValidOrigin, isValidSex } from '@/lib/virtual-girlfriend/types/traits';

export interface RawFormTraits {
  sex?: string;
  origin?: string;
  hairColor?: string;
  hairLength?: string;
  eyeColor?: string;
  skinTone?: string;
  bodyType?: string;
  figure?: string;
  age?: string | number;
}

const ORIGINS: readonly Origin[] = ['asian', 'latina', 'black', 'white', 'mixed', 'middle_eastern', 'south_asian'];
const BODY_TYPES: readonly BodyType[] = ['slim', 'athletic', 'curvy', 'petite'];
const AGES = [18, 21, 24, 27, 30, 35] as const;
const SKIN_TONES = ['fair', 'light', 'medium', 'tan', 'dark', 'deep'] as const;

const pickRandom = <T>(pool: readonly T[]): T => pool[Math.floor(Math.random() * pool.length)] as T;

const normalizeSex = (sex?: string): Sex => {
  const normalized = (sex ?? '').trim().toLowerCase();
  if (normalized === 'female') return 'female';
  if (normalized === 'male') return 'male';
  if (isValidSex(normalized)) return normalized;
  throw new Error(`Invalid sex value: ${sex ?? '<missing>'}`);
};

const normalizeOrigin = (origin?: string): Origin => {
  const normalized = (origin ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'random') return pickRandom(ORIGINS);
  if (isValidOrigin(normalized)) return normalized;

  if (normalized === 'caucasian') return 'white';
  if (normalized === 'africa' || normalized === 'african') return 'black';
  if (normalized === 'indian' || normalized === 'south asian' || normalized === 'south_asian') return 'south_asian';
  if (normalized === 'arab') return 'middle_eastern';

  console.warn('[normalizer] Unknown origin, defaulting to white:', origin);
  return 'white';
};

const normalizeHairColor = (hairColor?: string): string => {
  const normalized = (hairColor ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'random') return pickRandom(['black', 'dark brown', 'light brown', 'blonde', 'platinum', 'auburn', 'red', 'silver']);

  const mapped: Record<string, string> = {
    'jet black': 'black',
  };

  return mapped[normalized] ?? normalized;
};

const normalizeHairLength = (hairLength?: string): HairLength => {
  const normalized = (hairLength ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'random') return 'medium';
  if (isValidHairLength(normalized)) return normalized;

  if (normalized.includes('short')) return 'short';
  if (normalized.includes('long')) return 'long';
  return 'medium';
};

const normalizeEyeColor = (eyeColor?: string): string => {
  const normalized = (eyeColor ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'random') return pickRandom(['brown', 'hazel', 'green', 'blue']);
  return normalized;
};

const normalizeBodyType = (bodyType?: string, figure?: string): BodyType => {
  const source = (bodyType ?? figure ?? '').trim().toLowerCase();
  if (!source || source === 'random') return pickRandom(BODY_TYPES);
  if (isValidBodyType(source)) return source;

  if (source === 'chubby' || source === 'plus size' || source === 'plus-size') return 'curvy';

  console.warn('[normalizer] Unknown bodyType, defaulting to slim:', bodyType);
  return 'slim';
};

const normalizeAge = (age?: string | number): number => {
  if (typeof age === 'number' && Number.isFinite(age)) {
    return Math.max(18, Math.min(99, Math.floor(age)));
  }

  const normalized = String(age ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'random') return pickRandom(AGES);

  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed)) {
    console.warn('[normalizer] Invalid age, defaulting to 24:', age);
    return 24;
  }

  return Math.max(18, Math.min(99, parsed));
};

const normalizeSkinTone = (skinTone?: string): string => {
  const normalized = (skinTone ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'random') return pickRandom(SKIN_TONES);
  return normalized;
};

export function resolveSetupTraits(raw: RawFormTraits): PreviewTraits & { skinTone?: string } {
  return {
    sex: normalizeSex(raw.sex),
    origin: normalizeOrigin(raw.origin),
    hairColor: normalizeHairColor(raw.hairColor),
    hairLength: normalizeHairLength(raw.hairLength),
    eyeColor: normalizeEyeColor(raw.eyeColor),
    bodyType: normalizeBodyType(raw.bodyType, raw.figure),
    age: normalizeAge(raw.age),
    skinTone: normalizeSkinTone(raw.skinTone),
  };
}
