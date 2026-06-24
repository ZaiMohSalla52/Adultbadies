import Together from 'together-ai';
import { env } from '@/lib/env';
import { resolveVgTogetherModel } from '@/lib/virtual-girlfriend/llm-models';

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

const getClient = () => {
  if (!env.TOGETHER_API_KEY) {
    throw new Error('TOGETHER_API_KEY is not configured.');
  }

  return new Together({ apiKey: env.TOGETHER_API_KEY });
};

const toChatRole = (role: string): ChatRole => {
  if (role === 'system' || role === 'assistant') return role;
  return 'user';
};

const buildMessages = (body: TogetherLegacyBody) => {
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

const wrapCompletion = (content: string, model: string): Record<string, unknown> => ({
  output_text: content,
  model,
});

const createCompletion = async (body: TogetherLegacyBody, stream: boolean) => {
  const client = getClient();
  const model = resolveVgTogetherModel(body.model);
  const messages = buildMessages(body);
  const wantsJson = body.text?.format?.type === 'json_schema' || body.text?.format?.type === 'json_object';

  return client.chat.completions.create({
    model,
    messages,
    stream,
    temperature: body.temperature ?? 0.85,
    max_tokens: body.max_tokens ?? 2048,
    ...(wantsJson ? { response_format: { type: 'json_object' as const } } : {}),
  });
};

export const callTogetherChat = async (body: TogetherLegacyBody) => {
  const completion = await createCompletion(body, false);
  if (!('choices' in completion)) {
    throw new Error('Together chat completion returned an unexpected payload.');
  }

  const content = completion.choices[0]?.message?.content ?? '';
  const model = completion.model ?? resolveVgTogetherModel(body.model);
  return wrapCompletion(typeof content === 'string' ? content : String(content), model);
};

export const streamTogetherChat = async (
  body: TogetherLegacyBody,
  handlers: TogetherStreamHandlers = {},
): Promise<Record<string, unknown>> => {
  const model = resolveVgTogetherModel(body.model);
  const stream = await createCompletion(body, true);

  let fullText = '';

  if (Symbol.asyncIterator in Object(stream)) {
    for await (const chunk of stream as AsyncIterable<{
      choices?: Array<{ delta?: { content?: string | null } }>;
    }>) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        fullText += delta;
        handlers.onTextDelta?.(delta);
      }
    }
  } else if ('choices' in stream) {
    const content = stream.choices[0]?.message?.content ?? '';
    fullText = typeof content === 'string' ? content : String(content);
    if (fullText) handlers.onTextDelta?.(fullText);
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

