export type OutfitPreset = {
  id: string;
  label: string;
  icon: string;
  message: string;
  sceneHint: string;
};

export const OUTFIT_PRESETS: OutfitPreset[] = [
  {
    id: 'selfie',
    label: 'Selfie',
    icon: '📷',
    message: 'Send me a cute selfie 😊',
    sceneHint: 'Warm natural-light mirror selfie, playful smile, same face and identity.',
  },
  {
    id: 'casual',
    label: 'Casual',
    icon: '👕',
    message: 'Send me a pic in a cute casual outfit',
    sceneHint: 'Effortlessly chic casual outfit — fitted top, jeans or mini skirt, daytime candid selfie.',
  },
  {
    id: 'date-night',
    label: 'Date night',
    icon: '✨',
    message: 'Show me what you\'d wear on a date with me',
    sceneHint: 'Elegant evening dress, soft golden-hour lighting, flirty confident pose.',
  },
  {
    id: 'bikini',
    label: 'Bikini',
    icon: '👙',
    message: 'Send me a pic of you in a bikini',
    sceneHint: 'Stylish bikini at the beach or pool, bright natural light, confident relaxed pose.',
  },
  {
    id: 'lingerie',
    label: 'Lingerie',
    icon: '🖤',
    message: 'Send me a pic in lingerie',
    sceneHint: 'Tasteful lingerie set in soft bedroom lighting, intimate confident pose.',
  },
  {
    id: 'gym',
    label: 'Gym',
    icon: '💪',
    message: 'Send me a gym pic',
    sceneHint: 'Sleek flattering activewear, gym or fitness setting, athletic confident energy.',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    icon: '🛋️',
    message: 'Send me a cozy at-home pic',
    sceneHint: 'Soft loungewear or oversized knit, cozy apartment, warm morning light.',
  },
  {
    id: 'surprise',
    label: 'Surprise me',
    icon: '🎲',
    message: 'Surprise me with a new look — send me a photo',
    sceneHint: 'Brand-new outfit, pose, and setting — vary wardrobe and scene while keeping the same face.',
  },
];

export const STYLE_VIBE_OPTIONS = [
  { label: 'Casual chic', value: 'casual', icon: '👕' },
  { label: 'Elegant', value: 'elegant', icon: '👗' },
  { label: 'Edgy', value: 'edgy', icon: '🖤' },
  { label: 'Bohemian', value: 'bohemian', icon: '🌸' },
  { label: 'Sporty', value: 'sporty', icon: '💪' },
  { label: 'Professional', value: 'professional', icon: '💼' },
] as const;

export const POSE_PRESETS = [
  { id: 'standing', label: 'Standing', hint: 'standing confidently, full natural pose' },
  { id: 'seated', label: 'Seated', hint: 'seated casually, relaxed posture' },
  { id: 'leaning', label: 'Leaning', hint: 'leaning against a wall, candid over-shoulder glance' },
  { id: 'mirror', label: 'Mirror selfie', hint: 'mirror selfie, phone in hand, eye contact' },
] as const;

export const isOutfitPhotoRequest = (message: string) =>
  OUTFIT_PRESETS.some((preset) => preset.message.toLowerCase() === message.trim().toLowerCase())
  || /\b(bikini|lingerie|dress|outfit|wardrobe|wear|wearing|gym|cozy|casual|date night|selfie|surprise me with a new look)\b/i.test(message);