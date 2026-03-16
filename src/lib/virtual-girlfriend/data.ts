import { supabaseRest } from '@/lib/supabase/rest';
import type {
  PersonaProfile,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendConversationRecord,
  VirtualGirlfriendMemoryCandidate,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendVisualIdentityPack,
  VirtualGirlfriendVisualProfileRecord,
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendUserStyleDimensions,
  VirtualGirlfriendUserStyleProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const companionSelect =
  'id,user_id,name,display_bio,persona_profile,archetype,tone,affection_style,visual_aesthetic,preference_hints,profile_tags,setup_completed,disclosure_label,is_active,created_at,updated_at';


const visualProfileSelect =
  'id,user_id,companion_id,profile_version,style_version,prompt_hash,source_setup,identity_pack,continuity_notes,moderation_status,provenance,created_at,updated_at';

const companionImageSelect =
  'id,user_id,companion_id,visual_profile_id,image_kind,variant_index,origin_storage_provider,origin_storage_key,origin_mime_type,origin_byte_size,delivery_provider,delivery_public_id,delivery_url,width,height,prompt_hash,style_version,seed_metadata,lineage_metadata,moderation_status,moderation,provenance,quality_score,created_at';


const userStyleSelect =
  'id,user_id,companion_id,verbosity_preference,emoji_tone,flirt_intensity_preference,warmth_reassurance_preference,conversational_pacing_preference,directness_preference,playful_serious_balance,conversational_energy,adaptation_strength,stability_score,signals,explicit_overrides,last_learned_at,created_at,updated_at';

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getActiveVirtualGirlfriend = async (
  token: string,
  userId: string,
): Promise<VirtualGirlfriendCompanionRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: companionSelect,
      user_id: `eq.${userId}`,
      is_active: 'eq.true',
      order: 'updated_at.desc',
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};

export const upsertVirtualGirlfriend = async (
  token: string,
  input: {
    userId: string;
    name: string;
    bio: string;
    personaProfile: PersonaProfile;
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    preferenceHints?: string;
    profileTags?: string[];
  },
): Promise<VirtualGirlfriendCompanionRecord> => {
  const existing = await getActiveVirtualGirlfriend(token, input.userId);

  if (existing) {
    const rows = await supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
      method: 'PATCH',
      searchParams: new URLSearchParams({ id: `eq.${existing.id}`, user_id: `eq.${input.userId}` }),
      body: {
        name: input.name,
        display_bio: input.bio,
        persona_profile: input.personaProfile,
        archetype: input.archetype,
        tone: input.tone,
        affection_style: input.affectionStyle,
        visual_aesthetic: input.visualAesthetic,
        preference_hints: input.preferenceHints ?? null,
        profile_tags: input.profileTags ?? input.personaProfile.vibeTags,
        setup_completed: true,
        disclosure_label: 'AI-generated profile',
      },
      prefer: 'return=representation',
    });

    return rows[0]!;
  }

  const rows = await supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    method: 'POST',
    body: {
      user_id: input.userId,
      name: input.name,
      persona_prompt: 'Stage 9 Virtual Girlfriend structured persona',
      display_bio: input.bio,
      persona_profile: input.personaProfile,
      archetype: input.archetype,
      tone: input.tone,
      affection_style: input.affectionStyle,
      visual_aesthetic: input.visualAesthetic,
      preference_hints: input.preferenceHints ?? null,
      profile_tags: input.profileTags ?? input.personaProfile.vibeTags,
      setup_completed: true,
      disclosure_label: 'AI-generated profile',
      is_active: true,
    },
    prefer: 'return=representation',
  });

  return rows[0]!;
};


export const getLatestVirtualGirlfriendConversation = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendConversationRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendConversationRecord[]>('ai_conversations', token, {
    searchParams: new URLSearchParams({
      select: 'id,user_id,companion_id,title,mode,last_message_at,created_at,updated_at',
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      order: 'updated_at.desc',
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};

export const getOrCreateVirtualGirlfriendConversation = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendConversationRecord> => {
  const existing = await supabaseRest<VirtualGirlfriendConversationRecord[]>('ai_conversations', token, {
    searchParams: new URLSearchParams({
      select: 'id,user_id,companion_id,title,mode,last_message_at,created_at,updated_at',
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      order: 'updated_at.desc',
      limit: '1',
    }),
  });

  if (existing[0]) return existing[0];

  const inserted = await supabaseRest<VirtualGirlfriendConversationRecord[]>('ai_conversations', token, {
    method: 'POST',
    body: {
      user_id: userId,
      companion_id: companionId,
      title: 'Virtual Girlfriend Chat',
      mode: 'virtual_girlfriend',
      last_message_at: new Date().toISOString(),
    },
    prefer: 'return=representation',
  });

  return inserted[0]!;
};

export const getVirtualGirlfriendMessages = async (
  token: string,
  conversationId: string,
): Promise<VirtualGirlfriendMessageRecord[]> => {
  return supabaseRest<VirtualGirlfriendMessageRecord[]>('ai_messages', token, {
    searchParams: new URLSearchParams({
      select: 'id,conversation_id,user_id,role,content,model,token_count,moderation,created_at',
      conversation_id: `eq.${conversationId}`,
      order: 'created_at.asc',
      limit: '250',
    }),
  });
};

export const insertVirtualGirlfriendMessage = async (
  token: string,
  message: {
    conversationId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    moderation?: Record<string, unknown>;
  },
) => {
  await supabaseRest('ai_messages', token, {
    method: 'POST',
    body: {
      conversation_id: message.conversationId,
      user_id: message.userId,
      role: message.role,
      content: message.content,
      model: message.model ?? null,
      moderation: message.moderation ?? {},
    },
    prefer: 'return=minimal',
  });
};

export const touchVirtualGirlfriendConversation = async (token: string, conversationId: string) => {
  await supabaseRest('ai_conversations', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ id: `eq.${conversationId}` }),
    body: { last_message_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
};

export const getVirtualGirlfriendUserMessageCountForToday = async (token: string, userId: string): Promise<number> => {
  const now = new Date();
  const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

  const rows = await supabaseRest<{ id: string }[]>('ai_messages', token, {
    searchParams: new URLSearchParams({
      select: 'id',
      user_id: `eq.${userId}`,
      role: 'eq.user',
      created_at: `gte.${dayStartUtc}`,
      limit: '2000',
    }),
  });

  return rows.length;
};

export const getVirtualGirlfriendMemories = async (
  token: string,
  userId: string,
  companionId: string,
  limit = 200,
): Promise<VirtualGirlfriendMemoryRecord[]> => {
  return supabaseRest<VirtualGirlfriendMemoryRecord[]>('ai_memories', token, {
    searchParams: new URLSearchParams({
      select:
        'id,user_id,companion_id,conversation_id,memory_key,memory_value,category,summary,source_role,importance,salience,confidence,metadata,archived,use_count,embedding_status,created_at,last_recalled_at,last_used_at',
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      archived: 'eq.false',
      order: 'importance.desc,last_recalled_at.desc,created_at.desc',
      limit: String(limit),
    }),
  });
};

export const upsertVirtualGirlfriendMemory = async (
  token: string,
  input: {
    userId: string;
    companionId: string;
    conversationId: string | null;
    candidate: VirtualGirlfriendMemoryCandidate;
  },
) => {
  await supabaseRest('ai_memories', token, {
    method: 'POST',
    body: {
      user_id: input.userId,
      companion_id: input.companionId,
      conversation_id: input.conversationId,
      memory_key: input.candidate.key,
      memory_value: input.candidate.value,
      category: input.candidate.category,
      summary: input.candidate.summary ?? null,
      source_role: input.candidate.sourceRole,
      importance: clamp(input.candidate.importance, 1, 5),
      salience: clamp(input.candidate.salience, 1, 5),
      confidence: clamp(input.candidate.confidence, 0, 1),
      metadata: input.candidate.metadata ?? {},
      archived: false,
      last_recalled_at: new Date().toISOString(),
    },
    searchParams: new URLSearchParams({ on_conflict: 'user_id,companion_id,memory_key' }),
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
};

export const recordRecalledVirtualGirlfriendMemories = async (token: string, memoryIds: string[]) => {
  await Promise.all(
    memoryIds.map((memoryId) =>
      supabaseRest('ai_memories', token, {
        method: 'PATCH',
        searchParams: new URLSearchParams({ id: `eq.${memoryId}` }),
        body: {
          last_recalled_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
        prefer: 'return=minimal',
      }),
    ),
  );
};

export const retrieveRelevantVirtualGirlfriendMemories = async (
  token: string,
  input: {
    userId: string;
    companionId: string;
    queryText: string;
    maxItems?: number;
  },
): Promise<VirtualGirlfriendMemoryRecord[]> => {
  const pool = await getVirtualGirlfriendMemories(token, input.userId, input.companionId, 200);

  if (pool.length === 0) return [];

  const queryTokens = new Set(tokenize(input.queryText));
  const now = Date.now();

  const scored = pool.map((memory) => {
    const textTokens = tokenize(`${memory.memory_key} ${memory.memory_value} ${memory.summary ?? ''}`);
    const overlap = textTokens.filter((token) => queryTokens.has(token)).length;
    const relevance = queryTokens.size === 0 ? 0 : overlap / queryTokens.size;

    const timestamp = new Date(memory.last_recalled_at ?? memory.created_at).getTime();
    const ageDays = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
    const recency = 1 / (1 + ageDays / 7);

    const categoryBoost =
      memory.category === 'user_preference' && /(like|love|want|prefer|favorite)/i.test(input.queryText)
        ? 0.12
        : memory.category === 'emotional_signal' && /(feel|sad|happy|stressed|anxious|excited)/i.test(input.queryText)
          ? 0.12
          : memory.category === 'relationship_moment'
            ? 0.08
            : 0.04;

    const score =
      memory.importance * 0.23 +
      memory.salience * 0.2 +
      memory.confidence * 0.17 +
      recency * 0.2 +
      relevance * 0.2 +
      categoryBoost;

    return { memory, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, input.maxItems ?? 8)
    .map((entry) => entry.memory);
};


export const createVisualProfile = async (
  token: string,
  input: {
    userId: string;
    companionId: string;
    styleVersion: string;
    promptHash: string;
    sourceSetup: Record<string, unknown>;
    identityPack: VirtualGirlfriendVisualIdentityPack;
    continuityNotes?: string;
    moderationStatus?: string;
    provenance?: Record<string, unknown>;
  },
): Promise<VirtualGirlfriendVisualProfileRecord> => {
  const rows = await supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    method: 'POST',
    body: {
      user_id: input.userId,
      companion_id: input.companionId,
      profile_version: 'vg-v1',
      style_version: input.styleVersion,
      prompt_hash: input.promptHash,
      source_setup: input.sourceSetup,
      identity_pack: input.identityPack,
      continuity_notes: input.continuityNotes ?? null,
      moderation_status: input.moderationStatus ?? 'pending',
      provenance: input.provenance ?? {},
    },
    prefer: 'return=representation',
  });

  return rows[0]!;
};

export const insertCompanionImages = async (
  token: string,
  images: Array<Omit<VirtualGirlfriendCompanionImageRecord, 'id' | 'created_at'>>,
): Promise<VirtualGirlfriendCompanionImageRecord[]> => {
  return supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    method: 'POST',
    body: images,
    prefer: 'return=representation',
  });
};

export const getVirtualGirlfriendCompanionImages = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendCompanionImageRecord[]> => {
  return supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    searchParams: new URLSearchParams({
      select: companionImageSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      order: 'image_kind.asc,variant_index.asc,created_at.asc',
      limit: '30',
    }),
  });
};

export const getLatestVisualProfileForCompanion = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendVisualProfileRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    searchParams: new URLSearchParams({
      select: visualProfileSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      order: 'created_at.desc',
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};


export const getVirtualGirlfriendUserStyleProfile = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendUserStyleProfileRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendUserStyleProfileRecord[]>('ai_user_style_profiles', token, {
    searchParams: new URLSearchParams({
      select: userStyleSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      order: 'updated_at.desc',
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};

export const getOrCreateVirtualGirlfriendUserStyleProfile = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendUserStyleProfileRecord> => {
  const existing = await getVirtualGirlfriendUserStyleProfile(token, userId, companionId);
  if (existing) return existing;

  const rows = await supabaseRest<VirtualGirlfriendUserStyleProfileRecord[]>('ai_user_style_profiles', token, {
    method: 'POST',
    body: {
      user_id: userId,
      companion_id: companionId,
    },
    prefer: 'return=representation',
  });

  return rows[0]!;
};

export const patchVirtualGirlfriendUserStyleProfile = async (
  token: string,
  input: {
    userId: string;
    companionId: string;
    dimensions?: Partial<VirtualGirlfriendUserStyleDimensions>;
    adaptationStrength?: number;
    stabilityScore?: number;
    lastLearnedAt?: string | null;
    explicitOverrides?: Record<string, unknown>;
    signals?: Record<string, unknown>;
  },
): Promise<VirtualGirlfriendUserStyleProfileRecord> => {
  const body: Record<string, unknown> = {};

  if (input.dimensions) {
    if (typeof input.dimensions.verbosityPreference === 'number') body.verbosity_preference = clamp(input.dimensions.verbosityPreference, 0, 1);
    if (typeof input.dimensions.emojiTone === 'number') body.emoji_tone = clamp(input.dimensions.emojiTone, 0, 1);
    if (typeof input.dimensions.flirtIntensityPreference === 'number') body.flirt_intensity_preference = clamp(input.dimensions.flirtIntensityPreference, 0, 1);
    if (typeof input.dimensions.warmthReassurancePreference === 'number') body.warmth_reassurance_preference = clamp(input.dimensions.warmthReassurancePreference, 0, 1);
    if (typeof input.dimensions.conversationalPacingPreference === 'number') body.conversational_pacing_preference = clamp(input.dimensions.conversationalPacingPreference, 0, 1);
    if (typeof input.dimensions.directnessPreference === 'number') body.directness_preference = clamp(input.dimensions.directnessPreference, 0, 1);
    if (typeof input.dimensions.playfulSeriousBalance === 'number') body.playful_serious_balance = clamp(input.dimensions.playfulSeriousBalance, 0, 1);
    if (typeof input.dimensions.conversationalEnergy === 'number') body.conversational_energy = clamp(input.dimensions.conversationalEnergy, 0, 1);
  }

  if (typeof input.adaptationStrength === 'number') body.adaptation_strength = clamp(input.adaptationStrength, 0, 1);
  if (typeof input.stabilityScore === 'number') body.stability_score = clamp(input.stabilityScore, 0, 1);
  if (typeof input.lastLearnedAt !== 'undefined') body.last_learned_at = input.lastLearnedAt;
  if (input.explicitOverrides) body.explicit_overrides = input.explicitOverrides;
  if (input.signals) body.signals = input.signals;

  const rows = await supabaseRest<VirtualGirlfriendUserStyleProfileRecord[]>('ai_user_style_profiles', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${input.userId}`, companion_id: `eq.${input.companionId}` }),
    body,
    prefer: 'return=representation',
  });

  return rows[0]!;
};
