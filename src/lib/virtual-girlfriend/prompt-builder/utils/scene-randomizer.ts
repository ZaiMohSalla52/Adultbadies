/*
 * SCENE RANDOMIZER — builds varied scene/situation descriptors for gallery and chat.
 * Uses companion style/personality when available so wardrobes stay on-brand.
 */

import {
  pickSurpriseWardrobeForCompanion,
  pickWardrobeForCompanion,
  type WardrobeContext,
} from '@/lib/virtual-girlfriend/companion-wardrobe';

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

export function buildRandomScene(context: WardrobeContext = {}): string {
  const action = choose(ACTIONS);
  const where = choose(LOCATIONS);
  const clothes = pickWardrobeForCompanion(context);
  const light = choose(LIGHTING);
  return `${action} ${where}, wearing ${clothes}, ${light}`;
}

export function buildSurpriseScene(context: WardrobeContext = {}): string {
  const action = choose(ACTIONS);
  const where = choose(LOCATIONS);
  const clothes = pickSurpriseWardrobeForCompanion(context);
  const light = choose(LIGHTING);
  return `${action} ${where}, wearing ${clothes}, ${light}`;
}