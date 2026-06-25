import { env } from '@/lib/env';
import {
  buildModelsLabModelCandidates,
  VG_MODELSLAB_CHAT_MODEL,
} from '@/lib/virtual-girlfriend/llm-models';
import type { TogetherLegacyBody, TogetherStreamHandlers } from '@/lib/virtual-girlfriend/together';

const MODELSLAB_CHAT_URL = 'https://modelslab.com/api/uncensored-chat/v1/chat/completions';

type ChatRole = 'system' | 'user' | 'assistant';

type TogetherChatMessage = {
  role: ChatRole;
  content: string;
};

type ModelsLabCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
    delta?: { content?: string | null };
  }>;
};

const assertApiKey = () => {
  const key = env.MODELSLAB_API_KEY?.trim();
  if (!key) {
    throw new Error('MODELSLAB_API_KEY is not configured.');
  }
  return key;
};

const toChatRole = (role: string): ChatRole => {
  if (role === 'system' || role === 'assistant') return role;
  return 'user';
};

const buildMessages = (body: TogetherLegacyBody): TogetherChatMessage[] => {
  const messages = (body.input ?? []).map((message) => ({
    role: toChatRole(message.role),
    content: message.content,
  }));

  const schema = body.text?.format?.schema;
  if (schema) {
    const schemaInstruction = `Respond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema)}`;
    const systemIndex = messages.findIndex((message) => message.role === 'system');
    if (systemIndex >= 0) {
      messages[systemIndex] = {
        ...messages[systemIndex]!,
        content: `${messages[systemIndex]!.content}\n\n${schemaInstruction}`,
      };
    } else {
      messages.unshift({ role: 'system', content: schemaInstruction });
    }
  }

  return messages;
};

const buildRequestPayload = (body: TogetherLegacyBody, model: string, stream: boolean) => {
  const wantsJson = body.text?.format?.type === 'json_schema' || body.text?.format?.type === 'json_object';

  return {
    model,
    messages: buildMessages(body),
    stream,
    temperature: body.temperature ?? 0.9,
    max_tokens: body.max_tokens ?? 2048,
    ...(wantsJson ? { response_format: { type: 'json_object' as const } } : {}),
  };
};

const wrapCompletion = (content: string, model: string): Record<string, unknown> => ({
  output_text: content,
  model,
});

const isModelUnavailableError = (status: number, bodyText: string) =>
  status === 404 || (status === 400 && /model/i.test(bodyText));

const postModelsLabChat = async (body: TogetherLegacyBody, stream: boolean) => {
  const apiKey = assertApiKey();
  const candidates = buildModelsLabModelCandidates(body.model);
  let lastError = 'ModelsLab chat API failed with no model candidates.';

  for (const model of candidates) {
    const response = await fetch(MODELSLAB_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildRequestPayload(body, model, stream)),
    });

    if (response.ok) {
      return { response, model };
    }

    const errorText = await response.text();
    lastError = `ModelsLab chat API failed (${response.status}) with model ${model}: ${errorText}`;

    if (isModelUnavailableError(response.status, errorText)) {
      console.warn(`[modelslab-chat] model unavailable, trying fallback: ${model}`);
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError);
};

export const callModelsLabChat = async (body: TogetherLegacyBody) => {
  const { response, model } = await postModelsLabChat(body, false);
  const completion = (await response.json()) as ModelsLabCompletionResponse;
  const content = completion.choices?.[0]?.message?.content ?? '';

  return wrapCompletion(typeof content === 'string' ? content : String(content), completion.model ?? model);
};

export const streamModelsLabChat = async (
  body: TogetherLegacyBody,
  handlers: TogetherStreamHandlers = {},
): Promise<Record<string, unknown>> => {
  const { response, model } = await postModelsLabChat(body, true);

  if (!response.body) {
    throw new Error('ModelsLab chat stream returned an empty body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const next = await reader.read();
    if (next.done) break;

    buffer += decoder.decode(next.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const chunk = JSON.parse(trimmed.slice(6)) as ModelsLabCompletionResponse;
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          fullText += delta;
          handlers.onTextDelta?.(delta);
        }
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
  }

  const payload = wrapCompletion(fullText, model);
  handlers.onCompleted?.(payload);
  return payload;
};

export const defaultModelsLabChatModel = () => VG_MODELSLAB_CHAT_MODEL;