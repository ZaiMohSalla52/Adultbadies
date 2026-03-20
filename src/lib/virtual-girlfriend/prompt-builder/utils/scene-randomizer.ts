/*
 * SCENE RANDOMIZER — builds varied scene/situation descriptors for gallery and chat surfaces.
 * Modelled on the competitor's get_random_prompt() pattern: pick random action, location,
 * wardrobe, and lighting to give every image a unique situational context.
 */

function choose<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ACTIONS = [
  'sitting',
  'standing',
  'lying down',
  'reading a book',
  'drinking coffee',
  'looking out a window',
  'laughing',
  'posing',
  'getting dressed',
  'doing her makeup',
  'relaxing on a couch',
  'stretching',
  'leaning against a wall',
  'looking over her shoulder',
  'holding a glass of wine',
];

const LOCATIONS = [
  'in a cozy bedroom',
  'in a modern apartment',
  'in a luxury hotel room',
  'at a cafe',
  'on a rooftop terrace',
  'at the beach',
  'in a dimly lit lounge',
  'in a bathroom with soft lighting',
  'in a sunlit living room',
  'in a walk-in closet',
  'outdoors in a garden',
  'in a pool area',
  'at a bar',
  'in a dressing room',
];

const WARDROBE = [
  'in casual loungewear',
  'in an elegant evening dress',
  'in a fitted top and jeans',
  'in a silk robe',
  'in athleisure wear',
  'in a sundress',
  'in a stylish blazer',
  'in lingerie',
  'in a crop top',
  'in a summer dress',
  'in a tight bodycon dress',
  'in a sheer blouse',
];

const LIGHTING = [
  'warm golden hour light',
  'soft window light',
  'dim intimate lighting',
  'bright natural daylight',
  'candlelight',
  'neon ambient light',
  'blue cool mood lighting',
  'soft studio light',
  'harsh backlight silhouette',
  'dappled sunlight',
];

export function buildRandomScene(): string {
  const action = choose(ACTIONS);
  const where = choose(LOCATIONS);
  const clothes = choose(WARDROBE);
  const light = choose(LIGHTING);
  return `${action} ${where}, ${clothes}, ${light}`;
}
