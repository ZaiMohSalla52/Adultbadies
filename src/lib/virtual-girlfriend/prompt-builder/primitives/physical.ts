const normalizeOriginKey = (origin: string) => origin.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-');

const ETHNICITY_MAP: Record<string, { female: string; male: string }> = {
  black: { female: 'Black African woman with rich dark brown skin', male: 'Black African man with rich dark brown skin' },
  african: { female: 'Black African woman with rich dark brown skin', male: 'Black African man with rich dark brown skin' },
  white: { female: 'Caucasian woman with fair light skin', male: 'Caucasian man with fair light skin' },
  caucasian: { female: 'Caucasian woman with fair light skin', male: 'Caucasian man with fair light skin' },
  european: { female: 'European woman with fair skin', male: 'European man with fair skin' },
  asian: { female: 'East Asian woman with light golden skin', male: 'East Asian man with light golden skin' },
  'east-asian': { female: 'East Asian woman with light porcelain skin', male: 'East Asian man with light porcelain skin' },
  chinese: { female: 'Chinese woman with fair porcelain skin', male: 'Chinese man with fair porcelain skin' },
  japanese: { female: 'Japanese woman with fair skin', male: 'Japanese man with fair skin' },
  korean: { female: 'Korean woman with fair luminous skin', male: 'Korean man with fair luminous skin' },
  'south-asian': { female: 'South Asian woman with warm brown skin', male: 'South Asian man with warm brown skin' },
  indian: { female: 'Indian woman with warm brown skin', male: 'Indian man with warm brown skin' },
  'southeast-asian': { female: 'Southeast Asian woman with warm golden-tan skin', male: 'Southeast Asian man with warm golden-tan skin' },
  filipino: { female: 'Filipina woman with warm tan skin', male: 'Filipino man with warm tan skin' },
  latina: { female: 'Latina woman with warm olive-tan skin', male: 'Latino man with warm olive-tan skin' },
  hispanic: { female: 'Hispanic woman with warm olive skin', male: 'Hispanic man with warm olive skin' },
  'middle-eastern': { female: 'Middle Eastern woman with warm olive skin', male: 'Middle Eastern man with warm olive skin' },
  arab: { female: 'Arab woman with warm olive skin', male: 'Arab man with warm olive skin' },
  mixed: { female: 'mixed-race woman with warm medium skin', male: 'mixed-race man with warm medium skin' },
};

export const resolveStrongEthnicityLine = (
  sex: string,
  origin: string,
  skinTone?: string,
): string => {
  const key = normalizeOriginKey(origin);
  const entry = ETHNICITY_MAP[key];
  if (entry) {
    return sex.trim().toLowerCase() === 'male' ? entry.male : entry.female;
  }
  const subject = sex.trim().toLowerCase() === 'male' ? 'man' : 'woman';
  const skin = skinTone ? ` with ${skinTone} skin` : '';
  return `${origin} ${subject}${skin}`;
};

export const resolveBodyType = (bodyType: string): string => {
  const normalized = bodyType.trim().toLowerCase();
  if (normalized === 'slim') return 'slim';
  if (normalized === 'athletic') return 'athletic';
  if (normalized === 'curvy') return 'curvy';
  if (normalized === 'petite') return 'petite';
  return normalized || bodyType;
};

export const resolveHairDescriptor = (hairColor: string, hairLength: string): string => `${hairColor} ${hairLength} hair`;

export const resolvePhysicalTraitLine = (traits: {
  sex: string;
  origin: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  age: number;
  skinTone?: string;
}): string => {
  const originDescriptor = resolveStrongEthnicityLine(traits.sex, traits.origin, traits.skinTone);
  const hairDescriptor = resolveHairDescriptor(traits.hairColor, traits.hairLength);
  const bodyTypeDescriptor = resolveBodyType(traits.bodyType);

  return [
    originDescriptor,
    hairDescriptor,
    `${traits.eyeColor} eyes`,
    `${bodyTypeDescriptor} build`,
    `approximately ${traits.age} years old`,
  ].join(', ');
};

export const resolveEthnicityNegative = (origin: string): string | null => {
  const normalized = normalizeOriginKey(origin);
  const darkOrigins = ['black', 'african', 'south-asian', 'indian'];
  if (darkOrigins.includes(normalized)) {
    return 'Do not lighten skin. Maintain dark skin tone throughout.';
  }
  return null;
};
