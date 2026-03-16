import { env } from '@/lib/env';
import { moderateVirtualGirlfriendContent } from '@/lib/virtual-girlfriend/safety';
import { buildVirtualGirlfriendSystemPrompt } from '@/lib/virtual-girlfriend/orchestration';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendUserStyleProfileRecord,
} from '@/lib/virtual-girlfriend/types';

const OPENAI_URL = 'https://api.openai.com/v1';
const DEFAULT_REALTIME_MODEL = 'gpt-4o-realtime-preview';

export const buildVirtualGirlfriendVoiceSessionContext = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
}) => {
  const systemPrompt = buildVirtualGirlfriendSystemPrompt(input.companion, input.memories, input.styleProfile, 'voice');

  const voiceSafetyPolicy = [
    'Voice safety policy: if user requests disallowed content, briefly decline and redirect to safer romantic conversation.',
    'Never imply real-world meetings, off-platform contact, or non-adult roleplay.',
    'If uncertain about safety, choose cautious, warm, non-judgmental boundaries.',
  ].join(' ');

  return [systemPrompt, voiceSafetyPolicy].join('\n');
};

const assertApiKey = () => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured for virtual girlfriend voice sessions.');
  }

  return env.OPENAI_API_KEY;
};

const getRealtimeModel = () => env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL;

export const createVirtualGirlfriendRealtimeSession = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
}) => {
  const apiKey = assertApiKey();
  const model = getRealtimeModel();

  const context = buildVirtualGirlfriendVoiceSessionContext({
    companion: input.companion,
    memories: input.memories,
    styleProfile: input.styleProfile,
  });

  const safetyCheck = moderateVirtualGirlfriendContent('voice_session_bootstrap');
  if (!safetyCheck.allowed) {
    throw new Error('Voice session safety bootstrap failed.');
  }

  const response = await fetch(`${OPENAI_URL}/realtime/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      modalities: ['audio', 'text'],
      instructions: context,
      temperature: 0.8,
      metadata: {
        product_surface: 'virtual_girlfriend',
        companion_id: input.companion.id,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Realtime session creation failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    sessionId: typeof payload.id === 'string' ? payload.id : null,
    clientSecret:
      payload.client_secret && typeof payload.client_secret === 'object'
        ? ((payload.client_secret as Record<string, unknown>).value as string | undefined) ?? null
        : null,
    expiresAt: typeof payload.expires_at === 'number' ? new Date(payload.expires_at * 1000).toISOString() : null,
    model,
  };
};
