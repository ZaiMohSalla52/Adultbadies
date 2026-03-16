export const VIRTUAL_GIRLFRIEND_ARCHETYPES = [
  'Romantic Muse',
  'Playful Tease',
  'Soft Sweetheart',
  'Confident Bombshell',
  'Intellectual Charmer',
] as const;

export const VIRTUAL_GIRLFRIEND_TONES = ['Warm & caring', 'Flirty & witty', 'Bold & spicy', 'Calm & cozy'] as const;

export const VIRTUAL_GIRLFRIEND_AFFECTION_STYLES = [
  'Slow-burn romance',
  'Balanced affection',
  'High flirt energy',
] as const;

export const VIRTUAL_GIRLFRIEND_VISUAL_AESTHETICS = [
  'Glam nightlife',
  'Luxury soft life',
  'Cozy girl-next-door',
  'Futuristic cyber muse',
] as const;

export const VIRTUAL_GIRLFRIEND_MEMORY_CATEGORIES = [
  'user_fact',
  'user_preference',
  'emotional_signal',
  'relationship_moment',
  'style_observation',
] as const;

export type VirtualGirlfriendMemoryCategory = (typeof VIRTUAL_GIRLFRIEND_MEMORY_CATEGORIES)[number];

export type PersonaProfile = {
  displayName: string;
  shortBio: string;
  hiddenPersonalityTraits: string[];
  textingStyle: string;
  flirtStyle: string;
  comfortStyle: string;
  topicTendencies: string[];
  nicknameTendencies: string[];
  initialGreetingStyle: string;
  visualPromptDNA: {
    coreLook: string;
    styleAnchors: string[];
    colorPalette: string[];
    cameraMood: string;
  };
  vibeTags: string[];
};

export type VirtualGirlfriendCompanionRecord = {
  id: string;
  user_id: string;
  name: string;
  display_bio: string | null;
  persona_profile: PersonaProfile;
  archetype: string | null;
  tone: string | null;
  affection_style: string | null;
  visual_aesthetic: string | null;
  preference_hints: string | null;
  profile_tags: string[] | null;
  setup_completed: boolean;
  disclosure_label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VirtualGirlfriendConversationRecord = {
  id: string;
  user_id: string;
  companion_id: string;
  title: string | null;
  mode: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VirtualGirlfriendMessageRecord = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  model: string | null;
  token_count: number | null;
  moderation: Record<string, unknown>;
  created_at: string;
};

export type VirtualGirlfriendMemoryRecord = {
  id: string;
  user_id: string;
  companion_id: string;
  conversation_id: string | null;
  memory_key: string;
  memory_value: string;
  category: VirtualGirlfriendMemoryCategory;
  summary: string | null;
  source_role: 'system' | 'user' | 'assistant';
  importance: number;
  salience: number;
  confidence: number;
  metadata: Record<string, unknown>;
  archived: boolean;
  use_count: number;
  embedding_status: string;
  created_at: string;
  last_recalled_at: string | null;
  last_used_at: string | null;
};

export type VirtualGirlfriendMemoryCandidate = {
  key: string;
  value: string;
  category: VirtualGirlfriendMemoryCategory;
  summary?: string;
  importance: number;
  salience: number;
  confidence: number;
  sourceRole: 'user' | 'assistant';
  metadata?: Record<string, unknown>;
};

export type VirtualGirlfriendSetupPayload = {
  name?: string;
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints?: string;
};
