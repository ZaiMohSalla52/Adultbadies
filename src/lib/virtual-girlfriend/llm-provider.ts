import { callModelsLabChat, streamModelsLabChat } from '@/lib/virtual-girlfriend/modelslab-chat';
import {
  callTogetherChat as invokeTogetherServerlessChat,
  streamTogetherChat as invokeTogetherServerlessChatStream,
} from '@/lib/virtual-girlfriend/together';
import type { TogetherLegacyBody, TogetherStreamHandlers } from '@/lib/virtual-girlfriend/together';

export type { TogetherInputMessage, TogetherLegacyBody, TogetherStreamHandlers } from '@/lib/virtual-girlfriend/together';
export { buildTogetherReasoningParams } from '@/lib/virtual-girlfriend/together';
export { extractResponsesText } from '@/lib/virtual-girlfriend/together';

export type VgLlmProvider = 'together' | 'modelslab';

export const resolveVgLlmProvider = (): VgLlmProvider => {
  const configured = process.env.VG_LLM_PROVIDER?.trim().toLowerCase();
  if (configured === 'modelslab') return 'modelslab';
  if (configured === 'together') return 'together';

  if (process.env.TOGETHER_API_KEY?.trim()) return 'together';
  if (process.env.MODELSLAB_API_KEY?.trim()) return 'modelslab';

  throw new Error('TOGETHER_API_KEY is required for virtual girlfriend chat LLM.');
};

/** Chat + structured JSON tasks — Together Hermes DPO by default; ModelsLab optional fallback. */
export const callTogetherChat = async (body: TogetherLegacyBody) => {
  if (resolveVgLlmProvider() === 'modelslab') {
    return callModelsLabChat(body);
  }
  return invokeTogetherServerlessChat(body);
};

export const streamTogetherChat = async (
  body: TogetherLegacyBody,
  handlers: TogetherStreamHandlers = {},
) => {
  if (resolveVgLlmProvider() === 'modelslab') {
    return streamModelsLabChat(body, handlers);
  }
  return invokeTogetherServerlessChatStream(body, handlers);
};