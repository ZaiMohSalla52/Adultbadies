import { buildCanonicalPrompt, CANONICAL_PROMPT_VERSION } from './surfaces/canonical';
import { buildChatPrompt, CHAT_PROMPT_VERSION } from './surfaces/chat';
import { buildGalleryPrompt, GALLERY_PROMPT_VERSION } from './surfaces/gallery';
import { buildPreviewPrompt, PREVIEW_PROMPT_VERSION } from './surfaces/preview';
import { buildRegeneratePrompt, REGENERATE_PROMPT_VERSION } from './surfaces/regenerate';

export type { CompanionTraits, CanonicalTraits, PreviewTraits } from '../types/traits';
export type { SurfaceType } from '../types/surfaces';

export type PromptVersion =
  | typeof PREVIEW_PROMPT_VERSION
  | typeof CANONICAL_PROMPT_VERSION
  | typeof REGENERATE_PROMPT_VERSION
  | typeof GALLERY_PROMPT_VERSION
  | typeof CHAT_PROMPT_VERSION;

export {
  buildPreviewPrompt,
  buildCanonicalPrompt,
  buildRegeneratePrompt,
  buildGalleryPrompt,
  buildChatPrompt,
  PREVIEW_PROMPT_VERSION,
  CANONICAL_PROMPT_VERSION,
  REGENERATE_PROMPT_VERSION,
  GALLERY_PROMPT_VERSION,
  CHAT_PROMPT_VERSION,
};
