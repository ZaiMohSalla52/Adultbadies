import type { VirtualGirlfriendCompanionRecord } from '@/lib/virtual-girlfriend/types';
import type { CatalogCompanionBlueprint } from '@/lib/virtual-girlfriend/catalog/profiles';

const CATALOG_STUDENT_CLONE_CUES = [
  'beige or cream ribbed sweater or cardigan',
  'library bookshelves background',
  'indoor study aesthetic with coffee cup',
  'long black wavy hair with soft smile',
] as const;

export const buildCatalogPortraitSceneDirective = (blueprint: CatalogCompanionBlueprint) => {
  const scene = blueprint.portraitScene?.trim();
  if (scene) return scene;
  return null;
};

export const buildCatalogAvoidVisualCues = (
  blueprint: CatalogCompanionBlueprint,
  siblings: VirtualGirlfriendCompanionRecord[],
) => {
  const explicit = (blueprint.avoidVisualCues ?? []).map((cue) => cue.trim()).filter(Boolean);
  const siblingNames = siblings.map((s) => s.name).filter(Boolean);
  const siblingAvoid = siblingNames.length
    ? [`do not resemble ${siblingNames.join(', ')}`]
    : [];

  const studentCluster =
    blueprint.profile.occupation === 'student' && siblings.some((s) => s.structured_profile?.occupation === 'student')
      ? [...CATALOG_STUDENT_CLONE_CUES]
      : [];

  return [...new Set([...explicit, ...siblingAvoid, ...studentCluster])].slice(0, 10);
};

export const mergeCatalogFreeformDetails = (
  blueprint: CatalogCompanionBlueprint,
  siblings: VirtualGirlfriendCompanionRecord[],
) => {
  const base = blueprint.profile.freeformDetails?.trim() ?? '';
  const scene = buildCatalogPortraitSceneDirective(blueprint);
  const avoid = buildCatalogAvoidVisualCues(blueprint, siblings);

  const lines = [
    base || null,
    scene ? `CANONICAL PORTRAIT SCENE (mandatory): ${scene}` : null,
    avoid.length ? `AVOID visual overlap: ${avoid.join('; ')}.` : null,
  ].filter(Boolean);

  return lines.join(' ');
};

