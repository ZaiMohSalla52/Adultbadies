import { buildVirtualGirlfriendSystemPrompt } from '@/lib/virtual-girlfriend/orchestration';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendMemoryRecord,
  VirtualGirlfriendUserStyleProfileRecord,
} from '@/lib/virtual-girlfriend/types';

export const VOICE_PROVIDER_UNAVAILABLE_CODE = 'VG_VOICE_PROVIDER_UNAVAILABLE';

export class VirtualGirlfriendVoiceUnavailableError extends Error {
  code = VOICE_PROVIDER_UNAVAILABLE_CODE;

  constructor() {
    super(
      'Voice chat is temporarily unavailable. Text chat now runs on Together AI Dolphin models; realtime voice will return in a future update.',
    );
    this.name = 'VirtualGirlfriendVoiceUnavailableError';
  }
}

export const buildVirtualGirlfriendVoiceSessionContext = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
}) => {
  const systemPrompt = buildVirtualGirlfriendSystemPrompt(input.companion, input.memories, input.styleProfile, 'voice');

  const voiceSafetyPolicy = [
    'Voice safety policy: stay within consenting adult fiction and minor-safety rules.',
    'Never imply real-world meetings, off-platform contact, or non-adult roleplay.',
  ].join(' ');

  return [systemPrompt, voiceSafetyPolicy].join('\n');
};

export const createVirtualGirlfriendRealtimeSession = async (input: {
  companion: VirtualGirlfriendCompanionRecord;
  memories: VirtualGirlfriendMemoryRecord[];
  styleProfile: VirtualGirlfriendUserStyleProfileRecord;
}) => {
  void input;
  throw new VirtualGirlfriendVoiceUnavailableError();
};