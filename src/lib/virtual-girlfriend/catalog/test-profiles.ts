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
  {
    key: 'test-zara-black-athletic',
    name: 'Zara',
    archetype: 'city rooftop flirt',
    tone: 'confident and direct',
    affectionStyle: 'bold playful heat',
    visualAesthetic: 'sunset rooftop streetwear',
    portraitScene:
      'OUTDOOR urban rooftop at sunset, city skyline bokeh — cropped denim jacket over white sports bra, gold hoop earrings, short natural curls — NO beach, NO neon market, NO sundress, NO long straight hair.',
    avoidVisualCues: [
      'Holly',
      'Mei',
      'Yuna',
      'strawberry blonde',
      'chestnut wavy hair',
      'sundress',
      'neon lanterns',
      'curvy hourglass',
      'East Asian features',
    ],
    profile: {
      sex: 'female',
      age: 19,
      origin: 'black',
      hairColor: 'black',
      hairLength: 'short',
      eyeColor: 'dark brown',
      skinTone: 'deep',
      styleVibe: 'sporty',
      bodyType: 'athletic',
      breastSize: 'small',
      occupation: 'personal trainer',
      personality: 'confident_bold',
      sexuality: 'bisexual',
      freeformDetails:
        'Black slim athletic build, deep ebony skin, tight coily natural short hair, strong jaw, lean toned arms, denim streetwear — zero resemblance to Holly or Mei.',
    },
  },
  {
    key: 'test-rosa-latina-slim',
    name: 'Rosa',
    archetype: 'desert-road dreamer',
    tone: 'warm and soulful',
    affectionStyle: 'slow romantic pull',
    visualAesthetic: 'terracotta desert highway golden hour',
    portraitScene:
      'OUTDOOR desert highway pull-off at golden hour, red rock mesas behind — terracotta linen wrap top, turquoise pendant, wind-swept ponytail — NO beach boardwalk, NO night market, NO library, NO fair skin blonde.',
    avoidVisualCues: [
      'Holly',
      'Mei',
      'Yuna',
      'strawberry blonde',
      'blue eyes',
      'neon street',
      'red satin camisole',
      'East Asian face',
      'curvy hourglass',
    ],
    profile: {
      sex: 'female',
      age: 20,
      origin: 'latina',
      hairColor: 'dark brown',
      hairLength: 'long',
      eyeColor: 'hazel',
      skinTone: 'tan',
      styleVibe: 'bohemian',
      bodyType: 'slim',
      breastSize: 'small',
      occupation: 'photographer',
      personality: 'warm_romantic',
      sexuality: 'straight',
      freeformDetails:
        'Latina slim build, warm olive-tan skin, high ponytail dark brown hair, angular cheekbones, terracotta bohemian outfit, desert light — clearly not Caucasian beach or Asian neon.',
    },
  },
];