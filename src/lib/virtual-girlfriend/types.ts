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

export type VirtualGirlfriendGenerationStatus = 'generating' | 'ready' | 'failed';

export type VirtualGirlfriendImageGenerationState =
  | 'blocked_pre_gen'
  | 'generating'
  | 'partial_success'
  | 'ready'
  | 'failed'
  | 'review_pending';

export type VirtualGirlfriendStructuredProfile = {
  schemaVersion: 1;
  name: string;
  sex?: string | null;
  age?: string | number | null;
  origin?: string | null;
  hairColor?: string | null;
  figure?: string | null;
  bodyType?: string | null;
  occupation?: string | null;
  personality?: string | null;
  sexuality?: string | null;
  freeformDetails?: string | null;
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints: string | null;
  selectedPortraitPrompt?: string | null;
  selectedPortraitImage?: string | null;
};

export type VirtualGirlfriendResolvedProfile = {
  source: 'structured_profile' | 'legacy_derived';
  name: string | null;
  archetype: string | null;
  tone: string | null;
  affectionStyle: string | null;
  visualAesthetic: string | null;
  preferenceHints: string | null;
  personality: string | null;
  freeformDetails: string | null;
  likes: string[] | null;
  habits: string[] | null;
};


export const VIRTUAL_GIRLFRIEND_CANONICAL_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type VirtualGirlfriendCanonicalReviewStatus = (typeof VIRTUAL_GIRLFRIEND_CANONICAL_REVIEW_STATUSES)[number];

export type VirtualGirlfriendCompanionRecord = {
  id: string;
  user_id: string;
  name: string;
  display_bio: string | null;
  persona_profile: PersonaProfile;
  structured_profile: VirtualGirlfriendStructuredProfile | null;
  archetype: string | null;
  tone: string | null;
  affection_style: string | null;
  visual_aesthetic: string | null;
  preference_hints: string | null;
  profile_tags: string[] | null;
  setup_completed: boolean;
  generation_status: VirtualGirlfriendGenerationStatus;
  canonical_reference_image_id: string | null;
  disclosure_label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VirtualGirlfriendVisualIdentityInvariants = {
  ageBand: string;
  faceShape: string;
  eyeShapeColor: string;
  browCharacter: string;
  noseProfile: string;
  lipShape: string;
  skinToneBand: string;
  hairSignature: string;
  bodyPresentation: string;
  signatureAccessoryOrMotif: string;
};

export type VirtualGirlfriendVisualIdentityPack = {
  coreLookDescriptors: string[];
  portraitFramingStyle: string;
  wardrobeDirection: string;
  lightingMoodDirection: string;
  realismPolishLevel: string;
  identityInvariants: VirtualGirlfriendVisualIdentityInvariants;
  cameraCompositionPreferences: string[];
  continuityAnchors: string[];
  negativeConstraints: string[];
  negativeOverlapCues: string[];
};

export type VirtualGirlfriendVisualProfileRecord = {
  id: string;
  user_id: string;
  companion_id: string;
  profile_version: string;
  style_version: string;
  prompt_hash: string;
  source_setup: Record<string, unknown>;
  identity_pack: VirtualGirlfriendVisualIdentityPack;
  canonical_reference_image_id: string | null;
  canonical_reference_metadata: Record<string, unknown>;
  canonical_review_status: VirtualGirlfriendCanonicalReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  continuity_notes: string | null;
  moderation_status: string;
  provenance: Record<string, unknown>;
  seed_prompt?: string | null;
  prompt_version?: string | null;
  surface_type?: string | null;
  created_at: string;
  updated_at: string;
};

export type VirtualGirlfriendImageKind = 'canonical' | 'gallery' | 'thumbnail';

export type VirtualGirlfriendImageGenerationMode =
  | 'canonical'
  | 'gallery_from_canonical'
  | 'chat_from_canonical'
  | 'legacy_independent';

export type VirtualGirlfriendImageLineageMetadata = {
  revisedPrompt?: string | null;
  continuityAnchors?: string[];
  captureLabel?: string;
  captureMood?: string;
  captureEnvironment?: string;
  chatCategory?: VirtualGirlfriendImageCategory;
  source?: string;
  reference_image_id?: string | null;
  generation_mode?: VirtualGirlfriendImageGenerationMode;
  provider?: string;
  provider_model?: string;
  provider_request_id?: string | null;
  provider_job_id?: string | null;
  [key: string]: unknown;
};

export type VirtualGirlfriendCompanionStatus = Exclude<VirtualGirlfriendImageGenerationState, 'blocked_pre_gen'>;

export type VirtualGirlfriendSetupResult = {
  state: VirtualGirlfriendImageGenerationState;
  companionId?: string;
  conversationId?: string;
  message?: string;
  warning?: string;
  conflict?: {
    companionName?: string;
    guidance?: string[];
    topFieldLabels?: string[];
    conflictAreas?: string[];
  };
};

export type VirtualGirlfriendChatImageOutcome =
  | 'reused_existing'
  | 'generated_new'
  | 'skipped_prerequisites'
  | 'failed_generation'
  | 'not_requested';

export type VirtualGirlfriendCompanionImageRecord = {
  id: string;
  user_id: string;
  companion_id: string;
  visual_profile_id: string;
  image_kind: VirtualGirlfriendImageKind;
  variant_index: number;
  origin_storage_provider: string;
  origin_storage_key: string;
  origin_mime_type: string | null;
  origin_byte_size: number | null;
  delivery_provider: string;
  delivery_public_id: string | null;
  delivery_url: string;
  width: number | null;
  height: number | null;
  prompt_hash: string;
  style_version: string;
  seed_metadata: Record<string, unknown>;
  lineage_metadata: VirtualGirlfriendImageLineageMetadata;
  moderation_status: string;
  moderation: Record<string, unknown>;
  provenance: Record<string, unknown>;
  quality_score: number | null;
  prompt_text?: string | null;
  prompt_version?: string | null;
  surface_type?: string | null;
  created_at: string;
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
  content_type: 'text' | 'image' | 'mixed';
  attachments: VirtualGirlfriendMessageAttachment[];
  created_at: string;
};

export const VIRTUAL_GIRLFRIEND_IMAGE_CATEGORIES = [
  'selfie',
  'casual',
  'outfit',
  'indoor',
  'night-out',
  'good-morning',
  'good-night',
  'lifestyle',
] as const;

export type VirtualGirlfriendImageCategory = (typeof VIRTUAL_GIRLFRIEND_IMAGE_CATEGORIES)[number];

export type VirtualGirlfriendMessageAttachment = {
  kind: 'image';
  category: VirtualGirlfriendImageCategory;
  imageId: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
  source: 'gallery-reuse' | 'fresh-generation';
  promptHash?: string;
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

export const VIRTUAL_GIRLFRIEND_STYLE_CONTROL_PRESETS = [
  'more_playful',
  'more_caring',
  'shorter_replies',
  'bolder_flirting',
] as const;

export type VirtualGirlfriendStyleControlPreset = (typeof VIRTUAL_GIRLFRIEND_STYLE_CONTROL_PRESETS)[number];

export type VirtualGirlfriendUserStyleDimensions = {
  verbosityPreference: number;
  emojiTone: number;
  flirtIntensityPreference: number;
  warmthReassurancePreference: number;
  conversationalPacingPreference: number;
  directnessPreference: number;
  playfulSeriousBalance: number;
  conversationalEnergy: number;
};

export type VirtualGirlfriendUserStyleProfileRecord = {
  id: string;
  user_id: string;
  companion_id: string;
  verbosity_preference: number;
  emoji_tone: number;
  flirt_intensity_preference: number;
  warmth_reassurance_preference: number;
  conversational_pacing_preference: number;
  directness_preference: number;
  playful_serious_balance: number;
  conversational_energy: number;
  adaptation_strength: number;
  stability_score: number;
  signals: Record<string, unknown>;
  explicit_overrides: Record<string, unknown>;
  last_learned_at: string | null;
  created_at: string;
  updated_at: string;
};

export const VIRTUAL_GIRLFRIEND_PROACTIVE_TRIGGER_TYPES = [
  'conversation_gap',
  'memory_followup',
  'evening_checkin',
  'relationship_milestone',
] as const;

export type VirtualGirlfriendProactiveTriggerType = (typeof VIRTUAL_GIRLFRIEND_PROACTIVE_TRIGGER_TYPES)[number];

export const VIRTUAL_GIRLFRIEND_PROACTIVE_DELIVERY_STATUSES = [
  'pending',
  'processing',
  'delivered',
  'failed',
  'canceled',
] as const;

export type VirtualGirlfriendProactiveDeliveryStatus = (typeof VIRTUAL_GIRLFRIEND_PROACTIVE_DELIVERY_STATUSES)[number];

export type VirtualGirlfriendProactiveEventRecord = {
  id: string;
  user_id: string;
  companion_id: string;
  trigger_type: VirtualGirlfriendProactiveTriggerType;
  scheduled_at: string;
  delivery_status: VirtualGirlfriendProactiveDeliveryStatus;
  context_snapshot: Record<string, unknown>;
  delivered_at: string | null;
  delivered_message_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type VirtualGirlfriendSetupPayload = {
  name: string;
  sex?: string;
  age?: string | number;
  origin?: string;
  hairColor?: string;
  figure?: string;
  occupation?: string;
  personality?: string;
  sexuality?: string;
  freeformDetails?: string;
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  preferenceHints?: string;
  selectedPortraitPrompt?: string;
  selectedPortraitImage?: string;
  createNew?: boolean;
};
