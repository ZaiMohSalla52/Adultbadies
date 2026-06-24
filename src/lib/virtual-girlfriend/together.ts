import { env } from '@/lib/env';
import { buildTogetherModelCandidates } from '@/lib/virtual-girlfriend/llm-models';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';

type ChatRole = 'system' | 'user' | 'assistant';

export type TogetherInputMessage = {
  role: string;
  content: string;
};

export type TogetherLegacyBody = {
  model?: string;
  input?: TogetherInputMessage[];
  text?: {
    format?: {
      type: string;
      name?: string;
      schema?: Record<string, unknown>;
      strict?: boolean;
    };
  };
  reasoning?: { effort?: string };
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};

export type TogetherStreamHandlers = {
  onTextDelta?: (delta: string) => void;
  onCompleted?: (payload: Record<string, unknown>) => void;
};

type TogetherChatMessage = {
  role: ChatRole;
  content: string;
};

type TogetherCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
    delta?: { content?: string | null };
  }>;
};

const assertApiKey = () => {
  if (!env.TOGETHER_API_KEY) {
    throw new Error('TOGETHER_API_KEY is not configured.');
  }

  return env.TOGETHER_API_KEY;
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
    temperature: body.temperature ?? 0.85,
    max_tokens: body.max_tokens ?? 2048,
    ...(wantsJson ? { response_format: { type: 'json_object' as const } } : {}),
  };
};

const wrapCompletion = (content: string, model: string): Record<string, unknown> => ({
  output_text: content,
  model,
});

const isModelUnavailableError = (status: number, bodyText: string) =>
  status === 404 && (bodyText.includes('model_not_available') || bodyText.includes('Unable to access model'));

const postTogetherChat = async (body: TogetherLegacyBody, stream: boolean) => {
  const apiKey = assertApiKey();
  const candidates = buildTogetherModelCandidates(body.model);
  let lastError = 'Together chat API failed with no model candidates.';

  for (const model of candidates) {
    const response = await fetch(TOGETHER_API_URL, {
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
    lastError = `Together chat API failed (${response.status}) with model ${model}: ${errorText}`;

    if (isModelUnavailableError(response.status, errorText)) {
      console.warn(`[together] model unavailable, trying fallback: ${model}`);
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError);
};

export const callTogetherChat = async (body: TogetherLegacyBody) => {
  const { response, model } = await postTogetherChat(body, false);
  const completion = (await response.json()) as TogetherCompletionResponse;
  const content = completion.choices?.[0]?.message?.content ?? '';

  return wrapCompletion(typeof content === 'string' ? content : String(content), completion.model ?? model);
};

export const streamTogetherChat = async (
  body: TogetherLegacyBody,
  handlers: TogetherStreamHandlers = {},
): Promise<Record<string, unknown>> => {
  const { response, model } = await postTogetherChat(body, true);

  if (!response.body) {
    throw new Error('Together chat stream returned an empty body.');
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
        const chunk = JSON.parse(trimmed.slice(6)) as TogetherCompletionResponse;
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

export const extractResponsesText = (payload: Record<string, unknown>): string => {
  const outputText = typeof payload.output_text === 'string' ? payload.output_text : '';
  if (outputText) return outputText.trim();

  const choices = payload.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const message = (choices[0] as Record<string, unknown>).message;
    if (message && typeof message === 'object') {
      const content = (message as Record<string, unknown>).content;
      if (typeof content === 'string') return content.trim();
    }
  }

  return '';
};