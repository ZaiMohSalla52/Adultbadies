import { callModelsLabChat, streamModelsLabChat } from '@/lib/virtual-girlfriend/modelslab-chat';
import type { TogetherLegacyBody, TogetherStreamHandlers } from '@/lib/virtual-girlfriend/together';

export type { TogetherInputMessage, TogetherLegacyBody, TogetherStreamHandlers } from '@/lib/virtual-girlfriend/together';
export { buildTogetherReasoningParams } from '@/lib/virtual-girlfriend/together';
export { extractResponsesText } from '@/lib/virtual-girlfriend/together';

export type VgLlmProvider = 'modelslab';

export const resolveVgLlmProvider = (): VgLlmProvider => {
  if (!process.env.MODELSLAB_API_KEY?.trim()) {
    throw new Error('MODELSLAB_API_KEY is required for virtual girlfriend chat LLM.');
  }
  return 'modelslab';
};

/** Chat + structured JSON tasks — ModelsLab uncensored endpoint only. */
export const callTogetherChat = async (body: TogetherLegacyBody) => callModelsLabChat(body);

export const streamTogetherChat = async (
  body: TogetherLegacyBody,
  handlers: TogetherStreamHandlers = {},
) => streamModelsLabChat(body, handlers);