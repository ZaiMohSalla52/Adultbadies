import { supabaseRest } from '@/lib/supabase/rest';
import type {
  PersonaProfile,
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendConversationRecord,
  VirtualGirlfriendMemoryCandidate,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendMessageRecord,
  VirtualGirlfriendMessageAttachment,
  VirtualGirlfriendVisualIdentityPack,
  VirtualGirlfriendVisualProfileRecord,
  VirtualGirlfriendCompanionImageRecord,
  VirtualGirlfriendUserStyleDimensions,
  VirtualGirlfriendUserStyleProfileRecord,
  VirtualGirlfriendProactiveDeliveryStatus,
  VirtualGirlfriendProactiveEventRecord,
  VirtualGirlfriendProactiveTriggerType,
} from '@/lib/virtual-girlfriend/types';

const companionSelect =
  'id,user_id,name,display_bio,persona_profile,archetype,tone,affection_style,visual_aesthetic,preference_hints,profile_tags,setup_completed,generation_status,disclosure_label,is_active,created_at,updated_at';


const visualProfileSelect =
  'id,user_id,companion_id,profile_version,style_version,prompt_hash,source_setup,identity_pack,canonical_reference_image_id,canonical_reference_metadata,continuity_notes,moderation_status,provenance,created_at,updated_at';

const companionImageSelect =
  'id,user_id,companion_id,visual_profile_id,image_kind,variant_index,origin_storage_provider,origin_storage_key,origin_mime_type,origin_byte_size,delivery_provider,delivery_public_id,delivery_url,width,height,prompt_hash,style_version,seed_metadata,lineage_metadata,moderation_status,moderation,provenance,quality_score,created_at';


const userStyleSelect =
  'id,user_id,companion_id,verbosity_preference,emoji_tone,flirt_intensity_preference,warmth_reassurance_preference,conversational_pacing_preference,directness_preference,playful_serious_balance,conversational_energy,adaptation_strength,stability_score,signals,explicit_overrides,last_learned_at,created_at,updated_at';

const proactiveEventSelect =
  'id,user_id,companion_id,trigger_type,scheduled_at,delivery_status,context_snapshot,delivered_at,delivered_message_id,last_error,created_at,updated_at';

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const listVirtualGirlfriends = async (token: string, userId: string): Promise<VirtualGirlfriendCompanionRecord[]> => {
  return supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: companionSelect,
      user_id: `eq.${userId}`,
      order: 'is_active.desc,updated_at.desc',
      limit: '50',
    }),
  });
};

export const getVirtualGirlfriendById = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendCompanionRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: companionSelect,
      user_id: `eq.${userId}`,
      id: `eq.${companionId}`,
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};

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

export const getVirtualGirlfriendCompanionById = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendCompanionRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: companionSelect,
      user_id: `eq.${userId}`,
      id: `eq.${companionId}`,
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};

export const listVirtualGirlfriendCompanions = async (
  token: string,
  userId: string,
): Promise<VirtualGirlfriendCompanionRecord[]> => {
  return supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: companionSelect,
      user_id: `eq.${userId}`,
      order: 'is_active.desc,updated_at.desc',
      limit: '24',
    }),
  });
};

export const setActiveVirtualGirlfriend = async (token: string, userId: string, companionId: string) => {
  await supabaseRest('ai_companions', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${userId}`, is_active: 'eq.true' }),
    body: { is_active: false },
    prefer: 'return=minimal',
  });

  await supabaseRest('ai_companions', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${companionId}` }),
    body: { is_active: true },
    prefer: 'return=minimal',
  });
};

export const upsertVirtualGirlfriend = async (
  token: string,
  input: {
    userId: string;
    companionId?: string;
    createNew?: boolean;
    name: string;
    bio: string;
    personaProfile: PersonaProfile;
    archetype: string;
    tone: string;
    affectionStyle: string;
    visualAesthetic: string;
    preferenceHints?: string;
    profileTags?: string[];
    setActive?: boolean;
  },
): Promise<VirtualGirlfriendCompanionRecord> => {
  const targetCompanion = input.createNew
    ? null
    : input.companionId
      ? await getVirtualGirlfriendCompanionById(token, input.userId, input.companionId)
      : await getActiveVirtualGirlfriend(token, input.userId);

  if (targetCompanion) {
    const rows = await supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
      method: 'PATCH',
      searchParams: new URLSearchParams({ id: `eq.${targetCompanion.id}`, user_id: `eq.${input.userId}` }),
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
        generation_status: 'generating',
        disclosure_label: 'AI-generated profile',
      },
      prefer: 'return=representation',
    });

    if (input.setActive ?? true) {
      await setActiveVirtualGirlfriend(token, input.userId, targetCompanion.id);
      return { ...rows[0]!, is_active: true };
    }

    return rows[0]!;
  }

  await supabaseRest('ai_companions', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${input.userId}`, is_active: 'eq.true' }),
    body: { is_active: false },
    prefer: 'return=minimal',
  });

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
      generation_status: 'generating',
      disclosure_label: 'AI-generated profile',
      is_active: false,
    },
    prefer: 'return=representation',
  });

  const created = rows[0]!;
  if (input.setActive ?? true) {
    await setActiveVirtualGirlfriend(token, input.userId, created.id);
    return { ...created, is_active: true };
  }

  return created;
};


export const setVirtualGirlfriendGenerationStatus = async (
  token: string,
  userId: string,
  companionId: string,
  status: 'generating' | 'ready' | 'failed',
) => {
  await supabaseRest('ai_companions', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${companionId}` }),
    body: { generation_status: status },
    prefer: 'return=minimal',
  });
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
      select: 'id,conversation_id,user_id,role,content,model,token_count,moderation,content_type,attachments,created_at',
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
    contentType?: 'text' | 'image' | 'mixed';
    attachments?: VirtualGirlfriendMessageAttachment[];
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
      content_type: message.contentType ?? 'text',
      attachments: message.attachments ?? [],
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
    canonicalReferenceImageId?: string | null;
    canonicalReferenceMetadata?: Record<string, unknown>;
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
      canonical_reference_image_id: input.canonicalReferenceImageId ?? null,
      canonical_reference_metadata: input.canonicalReferenceMetadata ?? {},
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

export const setCanonicalReferenceImageForVisualProfile = async (
  token: string,
  input: {
    userId: string;
    visualProfileId: string;
    canonicalReferenceImageId: string;
    canonicalReferenceMetadata?: Record<string, unknown>;
  },
) => {
  const rows = await supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${input.userId}`, id: `eq.${input.visualProfileId}` }),
    body: {
      canonical_reference_image_id: input.canonicalReferenceImageId,
      canonical_reference_metadata: input.canonicalReferenceMetadata ?? {},
    },
    prefer: 'return=representation',
  });

  return rows[0] ?? null;
};

export const getCanonicalReferenceImageForCompanion = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendCompanionImageRecord | null> => {
  const visualProfile = await getLatestVisualProfileForCompanion(token, userId, companionId);
  if (!visualProfile?.canonical_reference_image_id) return null;

  const rows = await supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    searchParams: new URLSearchParams({
      select: companionImageSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      id: `eq.${visualProfile.canonical_reference_image_id}`,
      limit: '1',
    }),
  });

  return rows[0] ?? null;
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


export const listPendingVirtualGirlfriendProactiveEvents = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendProactiveEventRecord[]> => {
  return supabaseRest<VirtualGirlfriendProactiveEventRecord[]>('ai_proactive_events', token, {
    searchParams: new URLSearchParams({
      select: proactiveEventSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      delivery_status: 'eq.pending',
      order: 'scheduled_at.asc',
      limit: '10',
    }),
  });
};

export const listDueVirtualGirlfriendProactiveEvents = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendProactiveEventRecord[]> => {
  return supabaseRest<VirtualGirlfriendProactiveEventRecord[]>('ai_proactive_events', token, {
    searchParams: new URLSearchParams({
      select: proactiveEventSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      delivery_status: 'eq.pending',
      scheduled_at: `lte.${new Date().toISOString()}`,
      order: 'scheduled_at.asc',
      limit: '3',
    }),
  });
};

export const createVirtualGirlfriendProactiveEvent = async (
  token: string,
  input: {
    userId: string;
    companionId: string;
    triggerType: VirtualGirlfriendProactiveTriggerType;
    scheduledAt: string;
    contextSnapshot: Record<string, unknown>;
  },
): Promise<VirtualGirlfriendProactiveEventRecord> => {
  const rows = await supabaseRest<VirtualGirlfriendProactiveEventRecord[]>('ai_proactive_events', token, {
    method: 'POST',
    body: {
      user_id: input.userId,
      companion_id: input.companionId,
      trigger_type: input.triggerType,
      scheduled_at: input.scheduledAt,
      context_snapshot: input.contextSnapshot,
      delivery_status: 'pending',
    },
    prefer: 'return=representation',
  });

  return rows[0]!;
};

export const markVirtualGirlfriendProactiveEventStatus = async (
  token: string,
  input: {
    eventId: string;
    userId: string;
    status: VirtualGirlfriendProactiveDeliveryStatus;
    deliveredAt?: string | null;
    deliveredMessageId?: string | null;
    lastError?: string | null;
  },
) => {
  const body: Record<string, unknown> = { delivery_status: input.status };

  if (typeof input.deliveredAt !== 'undefined') body.delivered_at = input.deliveredAt;
  if (typeof input.deliveredMessageId !== 'undefined') body.delivered_message_id = input.deliveredMessageId;
  if (typeof input.lastError !== 'undefined') body.last_error = input.lastError;

  await supabaseRest('ai_proactive_events', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ id: `eq.${input.eventId}`, user_id: `eq.${input.userId}` }),
    body,
    prefer: 'return=minimal',
  });
};

export const getLatestDeliveredVirtualGirlfriendProactiveEvent = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendProactiveEventRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendProactiveEventRecord[]>('ai_proactive_events', token, {
    searchParams: new URLSearchParams({
      select: proactiveEventSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      delivery_status: 'eq.delivered',
      order: 'delivered_at.desc,created_at.desc',
      limit: '1',
    }),
  });

  return rows[0] ?? null;
};


export const insertVirtualGirlfriendMessageReturningId = async (
  token: string,
  message: {
    conversationId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    moderation?: Record<string, unknown>;
    contentType?: 'text' | 'image' | 'mixed';
    attachments?: VirtualGirlfriendMessageAttachment[];
  },
): Promise<{ id: string }> => {
  const rows = await supabaseRest<{ id: string }[]>('ai_messages', token, {
    method: 'POST',
    body: {
      conversation_id: message.conversationId,
      user_id: message.userId,
      role: message.role,
      content: message.content,
      model: message.model ?? null,
      moderation: message.moderation ?? {},
      content_type: message.contentType ?? 'text',
      attachments: message.attachments ?? [],
    },
    prefer: 'return=representation',
  });

  return rows[0]!;
};
