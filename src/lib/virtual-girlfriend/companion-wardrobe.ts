import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';

export type WardrobeContext = {
  sex?: string | null;
  styleVibe?: string | null;
  personality?: string | null;
};

const isMale = (sex?: string | null) => (sex ?? '').toLowerCase() === 'male';

const FEMALE_BY_STYLE: Record<string, string[]> = {
  casual: [
    'fitted crop top with high-waist jeans and delicate gold jewelry',
    'soft knit off-shoulder top with a mini skirt and playful daytime energy',
    'trendy matching lounge set with flattering silhouette',
  ],
  elegant: [
    'silk slip dress with refined neckline and statement earrings',
    'body-hugging cocktail dress in luxe fabric with polished styling',
    'tailored blazer over a satin camisole with sleek trousers',
  ],
  seductive: [
    'deep neckline bodycon mini dress with confident thigh-high framing',
    'open silk robe over lace lingerie with backlit silhouette',
    'sheer mesh top over a lace bralette with moody boudoir lighting',
  ],
  lingerie: [
    'black lace lingerie set with garter details and intimate bedroom light',
    'satin balconette set with stockings and soft candlelit glow',
    'sheer bodysuit with strategic cutouts and editorial adult glamour',
  ],
  glamorous: [
    'sequined evening gown with plunging neckline and red-carpet styling',
    'metallic mini dress with bold makeup-ready nightlife energy',
    'luxury silk gown with thigh slit and golden-hour glow',
  ],
  edgy: [
    'leather mini skirt with fitted corset top and chain accessories',
    'open leather jacket over lace bra with nightlife neon mood',
    'studded harness top with vinyl pants and confident pose',
  ],
  bohemian: [
    'flowy crochet crop top with high-slit maxi skirt and layered jewelry',
    'off-shoulder floral wrap dress with sun-kissed skin',
    'sheer kimono over bikini top with beach sunset vibe',
  ],
  athletic: [
    'tight sports bra and high-cut leggings in a gym mirror selfie',
    'matching athletic set with defined curves and post-workout glow',
    'compression shorts and cropped tank with sweat-sheen realism',
  ],
  sporty: [
    'color-block athleisure set with sneakers and candid energy',
    'tennis skirt with fitted polo crop and outdoor daylight',
    'yoga set in a bright studio with flexible pose',
  ],
  professional: [
    'fitted pencil skirt with silk blouse slightly unbuttoned at collar',
    'tailored sheath dress with confident office-after-hours polish',
    'structured blazer dress with heels and city-window light',
  ],
};

const MALE_BY_STYLE: Record<string, string[]> = {
  casual: [
    'fitted tee with well-cut jeans and relaxed confident posture',
    'open flannel over a tight tank with candid daytime energy',
    'premium loungewear set with clean minimal styling',
  ],
  elegant: [
    'tailored suit with slightly unbuttoned shirt and evening city light',
    'cashmere sweater with tailored trousers and refined polish',
    'dress shirt sleeves rolled with watch and magnetic gaze',
  ],
  seductive: [
    'unbuttoned dress shirt at waist with low-key bedroom light',
    'open robe at waist with defined torso and intimate mood',
    'wet-look fitted tee clinging to athletic build',
  ],
  lingerie: [
    'designer boxer briefs with confident mirror framing',
    'low-rise trunks with towel at shoulder post-shower vibe',
    'silk sleep shorts low on hips with warm lamp light',
  ],
  glamorous: [
    'velvet blazer open over bare chest with nightlife bokeh',
    'all-black designer outfit with dramatic contrast lighting',
    'tuxedo jacket with no shirt underneath and bold pose',
  ],
  edgy: [
    'leather jacket open over bare chest with moody neon',
    'distressed denim with harness chain and nightlife grit',
    'black denim and fitted tee with tattoo-forward styling',
  ],
  bohemian: [
    'linen shirt unbuttoned with pendant necklace and sunlit terrace',
    'relaxed open cardigan with beach sunset warmth',
    'flowy shirt with rolled sleeves and natural golden hour',
  ],
  athletic: [
    'shirtless defined torso with gym mirror pump lighting',
    'compression tank with training shorts and athletic sweat sheen',
    'post-workout towel at neck with damp hair realism',
  ],
  sporty: [
    'basketball shorts and tank with outdoor court energy',
    'running kit with candid motion and bright daylight',
    'hoodie pushed up with joggers and streetwear thirst-trap',
  ],
  professional: [
    'tailored suit with loosened tie and after-hours confidence',
    'crisp shirt with sleeves rolled and watch detail',
    'smart blazer over fitted tee with rooftop skyline',
  ],
};

const FEMALE_FALLBACK = [
  'figure-flattering fitted dress with confident sensual pose',
  'lace-trim camisole with high-waist shorts and warm apartment light',
  'stylish bikini or one-piece with poolside golden hour',
  'satin robe slipping off one shoulder in cozy bedroom',
  'tight bodysuit with moody editorial boudoir framing',
];

const MALE_FALLBACK = [
  'fitted tee emphasizing athletic build with candid selfie energy',
  'shirtless torso with natural window light and relaxed smirk',
  'tailored casual outfit with confident direct gaze',
  'towel at waist with steamy bathroom post-shower light',
  'open jacket over bare chest with nightlife mood',
];

const choose = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const resolveStyleVibeKey = (styleVibe?: string | null) => {
  const normalized = (styleVibe ?? 'casual').trim().toLowerCase();
  if (normalized in FEMALE_BY_STYLE) return normalized;
  if (/seduc|sultr|tease/.test(normalized)) return 'seductive';
  if (/lingerie|lace|boudoir/.test(normalized)) return 'lingerie';
  if (/glam|night/.test(normalized)) return 'glamorous';
  if (/athlet|gym|fit/.test(normalized)) return 'athletic';
  return 'casual';
};

export const pickWardrobeForCompanion = (context: WardrobeContext): string => {
  const styleKey = resolveStyleVibeKey(context.styleVibe);
  const pools = isMale(context.sex) ? MALE_BY_STYLE : FEMALE_BY_STYLE;
  const pool = pools[styleKey] ?? (isMale(context.sex) ? MALE_FALLBACK : FEMALE_FALLBACK);
  return choose(pool);
};

export const pickSurpriseWardrobeForCompanion = (context: WardrobeContext): string => {
  const styleKey = resolveStyleVibeKey(context.styleVibe);
  const pools = isMale(context.sex) ? MALE_BY_STYLE : FEMALE_BY_STYLE;
  const allOutfits = Object.values(pools).flat();
  const stylePool = pools[styleKey] ?? [];
  const mixed = [...stylePool, ...allOutfits, ...(isMale(context.sex) ? MALE_FALLBACK : FEMALE_FALLBACK)];
  return choose(mixed);
};

export const wardrobeDirectionForStyle = (styleVibe?: string | null, sex?: string | null): string => {
  const styleKey = resolveStyleVibeKey(styleVibe);
  const pools = isMale(sex) ? MALE_BY_STYLE : FEMALE_BY_STYLE;
  const pool = pools[styleKey];
  return pool?.[0] ?? pickWardrobeForCompanion({ sex, styleVibe });
};

export const wardrobeContextFromCompanion = (
  companion: VirtualGirlfriendCompanionRecord,
): WardrobeContext => ({
  sex: companion.structured_profile?.sex ?? null,
  styleVibe: companion.structured_profile?.styleVibe ?? companion.visual_aesthetic ?? null,
  personality: companion.structured_profile?.personality ?? companion.tone ?? null,
});