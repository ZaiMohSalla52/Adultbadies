export type OutfitPreset = {
  id: string;
  label: string;
  icon: string;
  message: string;
  sceneHint: string;
};

const FEMALE_OUTFITS: OutfitPreset[] = [
  {
    id: 'selfie',
    label: 'Selfie',
    icon: '📷',
    message: 'Send me a cute selfie 😊',
    sceneHint: 'Warm natural-light mirror selfie, playful smirk, same face and identity.',
  },
  {
    id: 'casual',
    label: 'Casual',
    icon: '👕',
    message: 'Send me a pic in a cute casual outfit',
    sceneHint: 'Fitted crop top, high-waist jeans or mini skirt, candid daytime selfie with flirty energy.',
  },
  {
    id: 'date-night',
    label: 'Date night',
    icon: '✨',
    message: 'Show me what you\'d wear on a date with me',
    sceneHint: 'Body-hugging evening dress, soft golden-hour lighting, confident seductive pose.',
  },
  {
    id: 'bikini',
    label: 'Bikini',
    icon: '👙',
    message: 'Send me a pic of you in a bikini',
    sceneHint: 'Stylish bikini at the beach or pool, sun-kissed skin, confident sensual pose.',
  },
  {
    id: 'lingerie',
    label: 'Lingerie',
    icon: '🖤',
    message: 'Send me a pic in lingerie',
    sceneHint: 'Lace lingerie set in dim bedroom lighting, intimate confident pose, adult editorial realism.',
  },
  {
    id: 'bodysuit',
    label: 'Bodysuit',
    icon: '🔥',
    message: 'Send me a pic in a tight bodysuit',
    sceneHint: 'Sheer or satin bodysuit, moody boudoir lighting, curves emphasized, same identity.',
  },
  {
    id: 'sheer',
    label: 'Sheer',
    icon: '💋',
    message: 'Send me something sheer and teasing',
    sceneHint: 'Sheer robe or top over lingerie, backlit silhouette, explicit adult glamour.',
  },
  {
    id: 'gym',
    label: 'Gym',
    icon: '💪',
    message: 'Send me a gym pic',
    sceneHint: 'Tight sports bra and leggings, gym mirror selfie, athletic thirst-trap energy.',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    icon: '🛋️',
    message: 'Send me a cozy at-home pic',
    sceneHint: 'Oversized shirt or silk robe slipping off one shoulder, cozy apartment, warm morning light.',
  },
  {
    id: 'surprise',
    label: 'Surprise me',
    icon: '🎲',
    message: 'Surprise me with a new look — send me a photo',
    sceneHint: 'Bold new outfit and pose — vary wardrobe and scene while keeping the same face.',
  },
];

const MALE_OUTFITS: OutfitPreset[] = [
  {
    id: 'selfie',
    label: 'Selfie',
    icon: '📷',
    message: 'Send me a selfie 😊',
    sceneHint: 'Natural-light mirror selfie, relaxed smirk, same face and identity.',
  },
  {
    id: 'casual',
    label: 'Casual',
    icon: '👕',
    message: 'Send me a casual pic',
    sceneHint: 'Fitted tee or open flannel, jeans, candid daytime selfie with confident energy.',
  },
  {
    id: 'shirtless',
    label: 'Shirtless',
    icon: '🔥',
    message: 'Send me a shirtless pic',
    sceneHint: 'Shirtless athletic torso, natural window light, confident relaxed pose, adult realism.',
  },
  {
    id: 'underwear',
    label: 'Underwear',
    icon: '🩲',
    message: 'Send me a pic in your underwear',
    sceneHint: 'Boxer briefs or trunks, bedroom or bathroom mirror, tasteful adult thirst-trap framing.',
  },
  {
    id: 'suit',
    label: 'Suit',
    icon: '🤵',
    message: 'Show me you in a suit',
    sceneHint: 'Tailored suit, slightly unbuttoned shirt, evening city light, magnetic confident pose.',
  },
  {
    id: 'gym',
    label: 'Gym',
    icon: '💪',
    message: 'Send me a gym pic',
    sceneHint: 'Tank top or shirtless pump, gym mirror selfie, defined physique, athletic energy.',
  },
  {
    id: 'towel',
    label: 'Towel',
    icon: '🚿',
    message: 'Send me a post-shower towel pic',
    sceneHint: 'Towel at waist, damp hair, steamy bathroom light, flirtatious adult editorial realism.',
  },
  {
    id: 'leather',
    label: 'Leather',
    icon: '🖤',
    message: 'Send me a pic in leather',
    sceneHint: 'Leather jacket open over bare chest or tight tee, nightlife mood, edgy confident pose.',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    icon: '🛋️',
    message: 'Send me a cozy at-home pic',
    sceneHint: 'Loungewear or unbuttoned sleep shirt, couch or bed, warm intimate morning light.',
  },
  {
    id: 'surprise',
    label: 'Surprise me',
    icon: '🎲',
    message: 'Surprise me with a new look — send me a photo',
    sceneHint: 'Bold new outfit and pose — vary wardrobe and scene while keeping the same face.',
  },
];

export const OUTFIT_PRESETS = FEMALE_OUTFITS;

export const getOutfitPresetsForSex = (sex?: string | null): OutfitPreset[] => {
  if ((sex ?? '').toLowerCase() === 'male') return MALE_OUTFITS;
  return FEMALE_OUTFITS;
};

export const STYLE_VIBE_OPTIONS = [
  { label: 'Casual chic', value: 'casual', icon: '👕' },
  { label: 'Elegant', value: 'elegant', icon: '👗' },
  { label: 'Sultry & seductive', value: 'seductive', icon: '🔥' },
  { label: 'Lingerie lover', value: 'lingerie', icon: '🖤' },
  { label: 'Nightlife glam', value: 'glamorous', icon: '✨' },
  { label: 'Edgy', value: 'edgy', icon: '⛓️' },
  { label: 'Bohemian', value: 'bohemian', icon: '🌸' },
  { label: 'Athletic thirst', value: 'athletic', icon: '🏋️' },
  { label: 'Sporty', value: 'sporty', icon: '💪' },
  { label: 'Professional', value: 'professional', icon: '💼' },
] as const;

export const POSE_PRESETS = [
  { id: 'standing', label: 'Standing', hint: 'standing confidently, full natural pose' },
  { id: 'seated', label: 'Seated', hint: 'seated casually, relaxed posture' },
  { id: 'leaning', label: 'Leaning', hint: 'leaning against a wall, candid over-shoulder glance' },
  { id: 'mirror', label: 'Mirror selfie', hint: 'mirror selfie, phone in hand, eye contact' },
  { id: 'bed', label: 'Bed pose', hint: 'on bed, intimate relaxed pose, soft directional light' },
] as const;

export const isOutfitPhotoRequest = (message: string) =>
  [...FEMALE_OUTFITS, ...MALE_OUTFITS].some((preset) => preset.message.toLowerCase() === message.trim().toLowerCase())
  || /\b(bikini|lingerie|bodysuit|sheer|shirtless|underwear|towel|suit|dress|outfit|wardrobe|wear|wearing|gym|cozy|casual|date night|selfie|surprise me with a new look|thirst)\b/i.test(message);