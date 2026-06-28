import type { CatalogCompanionBlueprint } from '@/lib/virtual-girlfriend/catalog/profiles';

/**
 * Catalog test batch — distinctness rules (learned from Mika/Yuna clone failure):
 *
 * 1. Never two "student + library + beige knit" in the same library.
 * 2. Each blueprint MUST set portraitScene (outdoor or unique indoor — not library).
 * 3. Vary hair color/length, skin tone, outfit, and setting across every row.
 * 4. Max one black-hair East Asian per batch unless face DNA + fingerprint gate passes.
 * 5. avoidVisualCues names siblings to steer prompts + canonical retry.
 */
export const CATALOG_TEST_SEED_BLUEPRINTS: CatalogCompanionBlueprint[] = [
  {
    key: 'test-yuna-asian-slim',
    name: 'Yuna',
    archetype: 'quiet bookworm',
    tone: 'gentle and observant',
    affectionStyle: 'slow tender warmth',
    visualAesthetic: 'soft overcast campus portrait',
    portraitScene:
      'OUTDOOR rainy university quad, holding clear umbrella, navy raincoat over white tee — absolutely NO library interior, NO bookshelves, NO beige sweater.',
    avoidVisualCues: ['Mika', 'beige cardigan', 'library background', 'coffee cup portrait'],
    profile: {
      sex: 'female',
      age: 18,
      origin: 'asian',
      hairColor: 'black',
      hairLength: 'long',
      eyeColor: 'dark brown',
      skinTone: 'light',
      styleVibe: 'casual',
      bodyType: 'slim',
      breastSize: 'small',
      occupation: 'student',
      personality: 'intellectual',
      sexuality: 'straight',
      freeformDetails:
        'Petite East Asian slim build, straight waist-length black hair with blunt bangs, narrow oval face, minimal makeup, navy raincoat — distinct from Mika.',
    },
  },
  {
    key: 'test-holly-caucasian-curvy',
    name: 'Holly',
    archetype: 'sun-kissed sweetheart',
    tone: 'warm and bubbly',
    affectionStyle: 'affectionate teasing',
    visualAesthetic: 'golden-hour beach boardwalk',
    portraitScene:
      'OUTDOOR sunlit beach boardwalk at golden hour, ocean bokeh behind — white linen sundress, wind in hair, NO indoor setting.',
    avoidVisualCues: ['black hair', 'library', 'sweater portrait', 'East Asian features'],
    profile: {
      sex: 'female',
      age: 21,
      origin: 'white',
      hairColor: 'strawberry blonde',
      hairLength: 'long',
      eyeColor: 'blue',
      skinTone: 'fair',
      styleVibe: 'casual',
      bodyType: 'curvy',
      breastSize: 'large',
      occupation: 'barista',
      personality: 'bubbly_energetic',
      sexuality: 'bisexual',
      freeformDetails:
        'Caucasian curvy hourglass, long wavy strawberry-blonde hair, freckles, blue eyes, white sundress, warm peach skin — clearly Western face.',
    },
  },
  {
    key: 'test-mei-asian-curvy',
    name: 'Mei',
    archetype: 'night-market flirt',
    tone: 'bold and teasing',
    affectionStyle: 'playful heat',
    visualAesthetic: 'warm neon street portrait',
    portraitScene:
      'OUTDOOR neon night-market street, red lantern glow — red satin camisole, chestnut hair, NO library, NO beige knit, NO coffee cup.',
    avoidVisualCues: ['Mika', 'Yuna', 'beige sweater', 'bookshelves', 'long straight black hair'],
    profile: {
      sex: 'female',
      age: 20,
      origin: 'asian',
      hairColor: 'chestnut brown',
      hairLength: 'medium',
      eyeColor: 'brown',
      skinTone: 'medium',
      styleVibe: 'seductive',
      bodyType: 'curvy',
      breastSize: 'medium',
      occupation: 'student',
      personality: 'playful_tease',
      sexuality: 'straight',
      freeformDetails:
        'Curvy East Asian hourglass, shoulder-length chestnut-brown wavy hair (NOT black), warm beige skin, red satin top, neon street — rounder face than Yuna.',
    },
  },
];