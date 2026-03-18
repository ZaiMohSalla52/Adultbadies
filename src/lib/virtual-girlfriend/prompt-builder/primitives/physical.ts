export const resolveOrigin = (origin: string): string => {
  const normalized = origin.trim().toLowerCase();
  if (normalized === 'asian') return 'East Asian features';
  if (normalized === 'latina') return 'Latina features';
  if (normalized === 'black') return 'Black features';
  if (normalized === 'white') return 'Caucasian features';
  if (normalized === 'mixed') return 'mixed ethnicity features';
  if (normalized === 'middle_eastern') return 'Middle Eastern features';
  if (normalized === 'south_asian' || normalized === 'south asian') return 'South Asian features';

  if (normalized === 'africa' || normalized === 'african') return 'Black features';
  if (normalized === 'caucasian') return 'Caucasian features';
  if (normalized === 'indian' || normalized === 'south asian') return 'South Asian features';
  if (normalized === 'arab') return 'Middle Eastern features';

  console.warn('[prompt-builder][physical] Unknown origin input, defaulting to Caucasian features.', { origin });
  return 'Caucasian features';
};

export const resolveBodyType = (bodyType: string): string => {
  const normalized = bodyType.trim().toLowerCase();
  if (normalized === 'slim') return 'slim build';
  if (normalized === 'athletic') return 'athletic build';
  if (normalized === 'curvy') return 'curvy figure';
  if (normalized === 'petite') return 'petite frame';
  return bodyType;
};

export const resolveHairDescriptor = (hairColor: string, hairLength: string): string => `${hairColor} ${hairLength} hair`;

export const resolvePhysicalTraitLine = (traits: {
  origin: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  age: number;
  skinTone?: string;
}): string => {
  const originDescriptor = resolveOrigin(traits.origin);
  const hairDescriptor = resolveHairDescriptor(traits.hairColor, traits.hairLength);
  const bodyTypeDescriptor = resolveBodyType(traits.bodyType);
  const skinToneDescriptor = traits.skinTone ? `${traits.skinTone} skin tone, ` : '';

  return `${originDescriptor}, ${hairDescriptor}, ${traits.eyeColor} eyes, ${skinToneDescriptor}${bodyTypeDescriptor}, approximately ${traits.age} years old`;
};
