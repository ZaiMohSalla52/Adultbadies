const normalizeOriginKey = (origin: string) => origin.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-');

const ETHNICITY_MAP: Record<string, { female: string; male: string }> = {
  // Black / African
  black: { female: 'Black woman with rich deep brown skin', male: 'Black man with rich deep brown skin' },
  african: { female: 'Black African woman with deep brown skin', male: 'Black African man with deep brown skin' },
  'west-african': { female: 'West African woman with deep chocolate-brown skin', male: 'West African man with deep chocolate-brown skin' },
  nigerian: { female: 'Nigerian woman with warm deep brown skin', male: 'Nigerian man with warm deep brown skin' },

  // White / European
  white: { female: 'white woman with fair skin', male: 'white man with fair skin' },
  caucasian: { female: 'Caucasian woman with light fair skin', male: 'Caucasian man with light fair skin' },
  european: { female: 'European woman with fair porcelain skin', male: 'European man with fair porcelain skin' },
  american: { female: 'American woman with light skin', male: 'American man with light skin' },
  french: { female: 'French woman with fair ivory skin', male: 'French man with fair ivory skin' },
  italian: { female: 'Italian woman with warm olive-toned fair skin', male: 'Italian man with warm olive-toned fair skin' },
  spanish: { female: 'Spanish woman with warm golden-fair skin', male: 'Spanish man with warm golden-fair skin' },
  russian: { female: 'Russian woman with pale porcelain skin', male: 'Russian man with pale porcelain skin' },
  scandinavian: { female: 'Scandinavian woman with pale luminous skin', male: 'Scandinavian man with pale luminous skin' },
  german: { female: 'German woman with fair light skin', male: 'German man with fair light skin' },
  british: { female: 'British woman with light fair skin', male: 'British man with light fair skin' },
  ukrainian: { female: 'Ukrainian woman with fair porcelain skin', male: 'Ukrainian man with fair porcelain skin' },

  // Asian — East
  asian: { female: 'East Asian woman with smooth light golden skin', male: 'East Asian man with smooth light golden skin' },
  'east-asian': { female: 'East Asian woman with porcelain-smooth skin', male: 'East Asian man with porcelain-smooth skin' },
  chinese: { female: 'Chinese woman with fair luminous porcelain skin', male: 'Chinese man with fair luminous porcelain skin' },
  japanese: { female: 'Japanese woman with smooth fair skin', male: 'Japanese man with smooth fair skin' },
  korean: { female: 'Korean woman with fair glass-skin complexion', male: 'Korean man with fair glass-skin complexion' },

  // Asian — South / Southeast
  'south-asian': { female: 'South Asian woman with warm medium-brown skin', male: 'South Asian man with warm medium-brown skin' },
  indian: { female: 'Indian woman with warm caramel-brown skin', male: 'Indian man with warm caramel-brown skin' },
  'south_asian': { female: 'South Asian woman with warm medium-brown skin', male: 'South Asian man with warm medium-brown skin' },
  'southeast-asian': { female: 'Southeast Asian woman with warm golden-tan skin', male: 'Southeast Asian man with warm golden-tan skin' },
  filipino: { female: 'Filipina woman with warm light-tan skin', male: 'Filipino man with warm light-tan skin' },
  thai: { female: 'Thai woman with warm golden skin', male: 'Thai man with warm golden skin' },
  vietnamese: { female: 'Vietnamese woman with warm light-tan skin', male: 'Vietnamese man with warm light-tan skin' },

  // Latina / Hispanic
  latina: { female: 'Latina woman with warm olive-tan skin', male: 'Latino man with warm olive-tan skin' },
  hispanic: { female: 'Hispanic woman with warm olive-brown skin', male: 'Hispanic man with warm olive-brown skin' },
  mexican: { female: 'Mexican woman with warm golden-tan skin', male: 'Mexican man with warm golden-tan skin' },
  brazilian: { female: 'Brazilian woman with warm sun-kissed tan skin', male: 'Brazilian man with warm sun-kissed tan skin' },
  colombian: { female: 'Colombian woman with warm light olive skin', male: 'Colombian man with warm light olive skin' },

  // Middle Eastern
  'middle-eastern': { female: 'Middle Eastern woman with warm olive-tan skin', male: 'Middle Eastern man with warm olive-tan skin' },
  'middle_eastern': { female: 'Middle Eastern woman with warm olive-tan skin', male: 'Middle Eastern man with warm olive-tan skin' },
  arab: { female: 'Arab woman with warm olive skin', male: 'Arab man with warm olive skin' },
  persian: { female: 'Persian woman with warm ivory-olive skin', male: 'Persian man with warm ivory-olive skin' },
  turkish: { female: 'Turkish woman with warm olive skin', male: 'Turkish man with warm olive skin' },

  // Mixed
  mixed: { female: 'mixed-heritage woman with warm medium-tone skin', male: 'mixed-heritage man with warm medium-tone skin' },
};

const BREAST_SIZE_MAP: Record<string, string> = {
  small: 'small chest',
  'small breasts': 'small chest',
  medium: 'medium chest',
  'medium breasts': 'medium chest',
  large: 'full bust',
  'large breasts': 'full bust',
  'very large': 'very full bust',
  'very large breasts': 'very full bust',
  'extra large': 'very full bust',
  busty: 'full bust',
};

export const resolveBreastSizeDescriptor = (breastSize?: string): string | null => {
  if (!breastSize) return null;
  const key = breastSize.trim().toLowerCase();
  return BREAST_SIZE_MAP[key] ?? null;
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
  if (normalized === 'athletic') return 'athletic toned';
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
  breastSize?: string;
}): string => {
  const isFemale = traits.sex?.trim().toLowerCase() !== 'male';
  const originDescriptor = resolveStrongEthnicityLine(traits.sex, traits.origin, traits.skinTone);
  const hairDescriptor = resolveHairDescriptor(traits.hairColor, traits.hairLength);
  const bodyTypeDescriptor = resolveBodyType(traits.bodyType);
  const breastDescriptor = isFemale ? resolveBreastSizeDescriptor(traits.breastSize) : null;

  return [
    originDescriptor,
    hairDescriptor,
    `${traits.eyeColor} eyes`,
    `${bodyTypeDescriptor} build`,
    breastDescriptor,
    `approximately ${traits.age} years old`,
  ]
    .filter(Boolean)
    .join(', ');
};

export const resolveEthnicityNegative = (origin: string): string | null => {
  const normalized = normalizeOriginKey(origin);
  const darkOrigins = ['black', 'african', 'west-african', 'nigerian', 'south-asian', 'south_asian', 'indian'];
  if (darkOrigins.includes(normalized)) {
    return 'Do not lighten or bleach skin tone. Preserve authentic dark skin throughout.';
  }
  return null;
};
