import { env } from '@/lib/env';
import { supabaseRest } from '@/lib/supabase/rest';
import {
  normalizeMessageAttachments,
  unlockAttachmentInList,
} from '@/lib/virtual-girlfriend/message-attachments';
import type {
  PersonaProfile,
  VirtualGirlfriendStructuredProfile,
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
  'id,user_id,name,display_bio,persona_profile,structured_profile,archetype,tone,affection_style,visual_aesthetic,preference_hints,profile_tags,setup_completed,generation_status,disclosure_label,is_active,created_at,updated_at';

/** Lightweight companion row for grid/list cards — avoids large persona JSON blobs. */
const companionGridSelect =
  'id,user_id,name,display_bio,archetype,setup_completed,generation_status,is_active,updated_at';

const companionThumbnailSelect =
  'id,companion_id,image_kind,delivery_url,width,height,prompt_hash,quality_score,lineage_metadata,created_at';


const visualProfileSelect =
  'id,user_id,companion_id,profile_version,style_version,prompt_hash,source_setup,identity_pack,canonical_reference_image_id,canonical_reference_metadata,canonical_review_status,reviewed_by,reviewed_at,review_notes,continuity_notes,moderation_status,provenance,seed_prompt,prompt_version,surface_type,created_at,updated_at';

const companionImageSelect =
  'id,user_id,companion_id,visual_profile_id,image_kind,variant_index,origin_storage_provider,origin_storage_key,origin_mime_type,origin_byte_size,delivery_provider,delivery_public_id,delivery_url,width,height,prompt_hash,style_version,seed_metadata,lineage_metadata,moderation_status,moderation,provenance,quality_score,prompt_text,prompt_version,surface_type,created_at';


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

export const listVirtualGirlfriendCompanionsForGrid = async (
  token: string,
  userId: string,
): Promise<VirtualGirlfriendCompanionRecord[]> => {
  return supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: companionGridSelect,
      user_id: `eq.${userId}`,
      order: 'is_active.desc,updated_at.desc',
      limit: '24',
    }),
  });
};

export const listVirtualGirlfriendCompanionsByIds = async (
  token: string,
  companionIds: string[],
): Promise<VirtualGirlfriendCompanionRecord[]> => {
  const ids = Array.from(new Set(companionIds.map((id) => id.trim()).filter(Boolean)));
  if (!ids.length) return [];

  return supabaseRest<VirtualGirlfriendCompanionRecord[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: companionSelect,
      id: `in.(${ids.join(',')})`,
      limit: String(Math.max(ids.length, 1)),
    }),
  });
};

export type DeleteCompanionRpcResult = {
  deleted: boolean;
  companion_id: string;
  promoted_companion_id: string | null;
  remaining_count: number;
};

export const deleteVirtualGirlfriendCompanion = async (
  token: string,
  companionId: string,
): Promise<DeleteCompanionRpcResult> => {
  const result = await supabaseRest<DeleteCompanionRpcResult>('rpc/delete_companion', token, {
    method: 'POST',
    body: { p_companion_id: companionId },
  });

  if (!result?.deleted) {
    throw new Error('Companion deletion did not complete.');
  }

  return result;
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
    structuredProfile: VirtualGirlfriendStructuredProfile;
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
        structured_profile: input.structuredProfile,
        archetype: input.archetype,
        tone: input.tone,
        affection_style: input.affectionStyle,
        visual_aesthetic: input.visualAesthetic,
        preference_hints: input.preferenceHints ?? null,
        profile_tags: input.profileTags ?? input.personaProfile.vibeTags,
        setup_completed: true,
        generation_status: 'generating',
        disclosure_label: '',
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
      structured_profile: input.structuredProfile,
      archetype: input.archetype,
      tone: input.tone,
      affection_style: input.affectionStyle,
      visual_aesthetic: input.visualAesthetic,
      preference_hints: input.preferenceHints ?? null,
      profile_tags: input.profileTags ?? input.personaProfile.vibeTags,
      setup_completed: true,
      generation_status: 'generating',
      disclosure_label: '',
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


export const setCanonicalReferenceImageId = async (
  token: string,
  userId: string,
  companionId: string,
  canonicalReferenceImageId: string,
) => {
  const latestProfile = await getLatestVisualProfileForCompanion(token, userId, companionId);
  if (!latestProfile) return;

  const rows = await supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    searchParams: new URLSearchParams({
      select: companionImageSelect,
      user_id: `eq.${userId}`,
      companion_id: `eq.${companionId}`,
      id: `eq.${canonicalReferenceImageId}`,
      limit: '1',
    }),
  });
  const canonicalImage = rows[0] ?? null;

  await setCanonicalReferenceImageForVisualProfile(token, {
    userId,
    visualProfileId: latestProfile.id,
    canonicalReferenceImageId,
    seedPrompt: canonicalImage?.prompt_text?.trim() || undefined,
    promptVersion: canonicalImage?.prompt_version?.trim() || undefined,
    surfaceType: canonicalImage?.surface_type?.trim() || 'canonical',
  });
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

export const getLatestVirtualGirlfriendConversationBatch = async (
  token: string,
  userId: string,
  companionIds: string[],
): Promise<Map<string, VirtualGirlfriendConversationRecord>> => {
  const ids = Array.from(new Set(companionIds.filter(Boolean)));
  if (!ids.length) return new Map();

  const rows = await supabaseRest<VirtualGirlfriendConversationRecord[]>('ai_conversations', token, {
    searchParams: new URLSearchParams({
      select: 'id,user_id,companion_id,title,mode,last_message_at,created_at,updated_at',
      user_id: `eq.${userId}`,
      companion_id: `in.(${ids.join(',')})`,
      order: 'updated_at.desc',
      limit: String(ids.length * 5),
    }),
  });

  const map = new Map<string, VirtualGirlfriendConversationRecord>();
  for (const row of rows) {
    if (!map.has(row.companion_id)) map.set(row.companion_id, row);
  }
  return map;
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

export const getVirtualGirlfriendMessageById = async (
  token: string,
  messageId: string,
  userId: string,
): Promise<VirtualGirlfriendMessageRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendMessageRecord[]>('ai_messages', token, {
    searchParams: new URLSearchParams({
      select: 'id,conversation_id,user_id,role,content,model,token_count,moderation,content_type,attachments,created_at',
      id: `eq.${messageId}`,
      user_id: `eq.${userId}`,
      limit: '1',
    }),
  });

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    attachments: normalizeMessageAttachments(row.attachments),
  };
};

export const getVirtualGirlfriendMessages = async (
  token: string,
  conversationId: string,
): Promise<VirtualGirlfriendMessageRecord[]> => {
  const rows = await supabaseRest<VirtualGirlfriendMessageRecord[]>('ai_messages', token, {
    searchParams: new URLSearchParams({
      select: 'id,conversation_id,user_id,role,content,model,token_count,moderation,content_type,attachments,created_at',
      conversation_id: `eq.${conversationId}`,
      order: 'created_at.asc',
      limit: '250',
    }),
  });

  return rows.map((row) => ({
    ...row,
    attachments: normalizeMessageAttachments(row.attachments),
  }));
};

const isMessagePatchDeniedError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('(401)') || message.includes('(403)') || message.includes('42501');
};

const patchVirtualGirlfriendMessageViaServiceRole = async (
  messageId: string,
  patch: {
    contentType?: 'text' | 'image' | 'mixed';
    attachments?: VirtualGirlfriendMessageAttachment[];
  },
) => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  const response = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ai_messages?id=eq.${encodeURIComponent(messageId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        ...(patch.contentType ? { content_type: patch.contentType } : {}),
        ...(patch.attachments ? { attachments: patch.attachments } : {}),
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase service message patch failed (${response.status}): ${message}`);
  }
};

export const getLatestVirtualGirlfriendMessage = async (
  token: string,
  conversationId: string,
): Promise<VirtualGirlfriendMessageRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendMessageRecord[]>('ai_messages', token, {
    searchParams: new URLSearchParams({
      select: 'id,conversation_id,user_id,role,content,created_at',
      conversation_id: `eq.${conversationId}`,
      order: 'created_at.desc',
      limit: '1',
    }),
  });
  return rows[0] ?? null;
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
    canonicalReviewStatus?: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
    provenance?: Record<string, unknown>;
    seedPrompt?: string;
    promptVersion?: string;
    surfaceType?: string;
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
      canonical_review_status: input.canonicalReviewStatus ?? 'pending',
      reviewed_by: input.reviewedBy ?? null,
      reviewed_at: input.reviewedAt ?? null,
      review_notes: input.reviewNotes ?? null,
      provenance: input.provenance ?? {},
      seed_prompt: input.seedPrompt ?? null,
      prompt_version: input.promptVersion ?? null,
      surface_type: input.surfaceType ?? null,
    },
    prefer: 'return=representation',
  });

  return rows[0]!;
};

export const insertCompanionImages = async (
  token: string,
  images: Array<Omit<VirtualGirlfriendCompanionImageRecord, 'id' | 'created_at' | 'prompt_text' | 'prompt_version' | 'surface_type'> & {
    promptText?: string;
    promptVersion?: string;
    surfaceType?: string;
  }>,
): Promise<VirtualGirlfriendCompanionImageRecord[]> => {
  const body = images.map((image) => {
    const { promptText, promptVersion, surfaceType, ...rest } = image;
    return {
      ...rest,
      prompt_text: promptText ?? null,
      prompt_version: promptVersion ?? null,
      surface_type: surfaceType ?? null,
    };
  });

  return supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    method: 'POST',
    body,
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

export const getVirtualGirlfriendCompanionImagesBatch = async (
  token: string,
  userId: string,
  companionIds: string[],
): Promise<Map<string, VirtualGirlfriendCompanionImageRecord[]>> => {
  const ids = Array.from(new Set(companionIds.filter(Boolean)));
  if (!ids.length) return new Map();

  const rows = await supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    searchParams: new URLSearchParams({
      select: companionImageSelect,
      user_id: `eq.${userId}`,
      companion_id: `in.(${ids.join(',')})`,
      order: 'image_kind.asc,variant_index.asc,created_at.asc',
      limit: String(ids.length * 30),
    }),
  });

  const map = new Map<string, VirtualGirlfriendCompanionImageRecord[]>();
  for (const row of rows) {
    const existing = map.get(row.companion_id) ?? [];
    existing.push(row);
    map.set(row.companion_id, existing);
  }
  return map;
};

/**
 * Card/grid thumbnails only — one canonical portrait per companion.
 * Avoids scanning hundreds of chat gallery rows (image_kind=gallery) per companion.
 */
export const getVirtualGirlfriendCompanionThumbnailBatch = async (
  token: string,
  userId: string,
  companionIds: string[],
): Promise<Map<string, VirtualGirlfriendCompanionImageRecord[]>> => {
  const ids = Array.from(new Set(companionIds.filter(Boolean)));
  if (!ids.length) return new Map();

  const rows = await supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    searchParams: new URLSearchParams({
      select: companionThumbnailSelect,
      user_id: `eq.${userId}`,
      companion_id: `in.(${ids.join(',')})`,
      image_kind: 'eq.canonical',
      order: 'created_at.desc',
      limit: String(ids.length),
    }),
  });

  const map = new Map<string, VirtualGirlfriendCompanionImageRecord[]>();
  for (const row of rows) {
    const existing = map.get(row.companion_id) ?? [];
    if (!existing.some((image) => image.id === row.id)) {
      existing.push(row);
      map.set(row.companion_id, existing);
    }
  }
  return map;
};

export const listVirtualGirlfriendCompanionImagesByIds = async (
  token: string,
  imageIds: string[],
): Promise<VirtualGirlfriendCompanionImageRecord[]> => {
  const ids = Array.from(new Set(imageIds.map((id) => id.trim()).filter(Boolean)));
  if (!ids.length) return [];

  return supabaseRest<VirtualGirlfriendCompanionImageRecord[]>('ai_companion_images', token, {
    searchParams: new URLSearchParams({
      select: companionImageSelect,
      id: `in.(${ids.join(',')})`,
      limit: String(Math.max(ids.length, 1)),
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
    canonicalReviewStatus?: 'pending' | 'approved' | 'rejected';
    seedPrompt?: string;
    promptVersion?: string;
    surfaceType?: string;
  },
) => {
  const rows = await supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ user_id: `eq.${input.userId}`, id: `eq.${input.visualProfileId}` }),
    body: {
      canonical_reference_image_id: input.canonicalReferenceImageId,
      canonical_reference_metadata: input.canonicalReferenceMetadata ?? {},
      canonical_review_status: input.canonicalReviewStatus ?? 'pending',
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      seed_prompt: input.seedPrompt ?? null,
      prompt_version: input.promptVersion ?? null,
      surface_type: input.surfaceType ?? null,
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

export const getVisualProfileById = async (
  token: string,
  visualProfileId: string,
): Promise<VirtualGirlfriendVisualProfileRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    searchParams: new URLSearchParams({
      select: visualProfileSelect,
      id: `eq.${visualProfileId}`,
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

const isSupabaseDuplicateKeyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /23505|409/.test(message) || /duplicate key/i.test(message);
};

export const getOrCreateVirtualGirlfriendUserStyleProfile = async (
  token: string,
  userId: string,
  companionId: string,
): Promise<VirtualGirlfriendUserStyleProfileRecord> => {
  const existing = await getVirtualGirlfriendUserStyleProfile(token, userId, companionId);
  if (existing) return existing;

  try {
    const rows = await supabaseRest<VirtualGirlfriendUserStyleProfileRecord[]>('ai_user_style_profiles', token, {
      method: 'POST',
      searchParams: new URLSearchParams({ on_conflict: 'user_id,companion_id' }),
      body: {
        user_id: userId,
        companion_id: companionId,
      },
      prefer: 'resolution=ignore-duplicates,return=representation',
    });

    if (rows?.[0]) return rows[0];
  } catch (error) {
    if (!isSupabaseDuplicateKeyError(error)) throw error;
  }

  const resolved = await getVirtualGirlfriendUserStyleProfile(token, userId, companionId);
  if (!resolved) {
    throw new Error('Unable to load companion style profile.');
  }

  return resolved;
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


export const patchVirtualGirlfriendMessage = async (
  token: string,
  messageId: string,
  patch: {
    contentType?: 'text' | 'image' | 'mixed';
    attachments?: VirtualGirlfriendMessageAttachment[];
  },
) => {
  try {
    await supabaseRest('ai_messages', token, {
      method: 'PATCH',
      searchParams: new URLSearchParams({ id: `eq.${messageId}` }),
      body: {
        ...(patch.contentType ? { content_type: patch.contentType } : {}),
        ...(patch.attachments ? { attachments: patch.attachments } : {}),
      },
      prefer: 'return=minimal',
    });
  } catch (error) {
    if (!isMessagePatchDeniedError(error)) throw error;
    console.warn(
      '[virtual-girlfriend] ai_messages update denied — using service-role fallback. Run supabase/migrations/023_ai_messages_update_own.sql.',
    );
    await patchVirtualGirlfriendMessageViaServiceRole(messageId, patch);
  }
};

/** After a paid unblur, persist unlocked state on any chat messages that reference the image. */
export const markChatImageUnlockedInMessages = async (
  token: string,
  userId: string,
  imageId: string,
) => {
  const rows = await supabaseRest<Array<{ id: string; attachments: unknown }>>('ai_messages', token, {
    searchParams: new URLSearchParams({
      select: 'id,attachments',
      user_id: `eq.${userId}`,
      content_type: 'eq.mixed',
      order: 'created_at.desc',
      limit: '200',
    }),
  });

  const targets = rows
    .map((row) => ({
      id: row.id,
      attachments: normalizeMessageAttachments(row.attachments),
    }))
    .filter((row) => row.attachments.some((attachment) => attachment.imageId === imageId));

  await Promise.all(
    targets.map((row) =>
      patchVirtualGirlfriendMessage(token, row.id, {
        attachments: unlockAttachmentInList(row.attachments, imageId),
      }),
    ),
  );
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


export const listPendingCanonicalReviewVisualProfiles = async (
  token: string,
): Promise<VirtualGirlfriendVisualProfileRecord[]> => {
  return supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    searchParams: new URLSearchParams({
      select: visualProfileSelect,
      canonical_review_status: 'eq.pending',
      order: 'created_at.desc',
      limit: '50',
    }),
  });
};

export const listCanonicalReviewVisualProfilesByStatus = async (
  token: string,
  status: 'pending' | 'approved' | 'rejected',
  limit = 50,
): Promise<VirtualGirlfriendVisualProfileRecord[]> => {
  return supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    searchParams: new URLSearchParams({
      select: visualProfileSelect,
      canonical_review_status: `eq.${status}`,
      order: 'updated_at.desc',
      limit: String(limit),
    }),
  });
};

export const setCanonicalReviewDecisionForVisualProfile = async (
  token: string,
  input: {
    visualProfileId: string;
    decision: 'approved' | 'rejected';
    reviewedBy: string;
    reviewNotes?: string;
  },
): Promise<VirtualGirlfriendVisualProfileRecord | null> => {
  const rows = await supabaseRest<VirtualGirlfriendVisualProfileRecord[]>('ai_companion_visual_profiles', token, {
    method: 'PATCH',
    searchParams: new URLSearchParams({ id: `eq.${input.visualProfileId}` }),
    body: {
      canonical_review_status: input.decision,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_notes: input.reviewNotes?.trim() ? input.reviewNotes.trim() : null,
    },
    prefer: 'return=representation',
  });

  return rows[0] ?? null;
};
