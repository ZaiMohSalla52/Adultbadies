import { callModelsLabChat, streamModelsLabChat } from '@/lib/virtual-girlfriend/modelslab-chat';
import {
  callTogetherChat as callTogetherChatImpl,
  streamTogetherChat as streamTogetherChatImpl,
  type TogetherLegacyBody,
  type TogetherStreamHandlers,
} from '@/lib/virtual-girlfriend/together';

export type { TogetherInputMessage, TogetherLegacyBody, TogetherStreamHandlers } from '@/lib/virtual-girlfriend/together';
export { buildTogetherReasoningParams } from '@/lib/virtual-girlfriend/together';
export { extractResponsesText } from '@/lib/virtual-girlfriend/together';

export type VgLlmProvider = 'modelslab' | 'together';

export const resolveVgLlmProvider = (): VgLlmProvider => {
  const configured = process.env.VG_LLM_PROVIDER?.trim().toLowerCase();
  if (configured === 'modelslab' || configured === 'together') {
    return configured;
  }

  if (process.env.MODELSLAB_API_KEY?.trim()) return 'modelslab';
  return 'together';
};

const useModelsLabChat = () => resolveVgLlmProvider() === 'modelslab';

export const callTogetherChat = async (body: TogetherLegacyBody) => {
  if (useModelsLabChat()) {
    return callModelsLabChat(body);
  }
  return callTogetherChatImpl(body);
};

export const streamTogetherChat = async (
  body: TogetherLegacyBody,
  handlers: TogetherStreamHandlers = {},
) => {
  if (useModelsLabChat()) {
    return streamModelsLabChat(body, handlers);
  }
  return streamTogetherChatImpl(body, handlers);
};