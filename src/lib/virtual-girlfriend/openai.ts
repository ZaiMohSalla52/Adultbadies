import { env } from '@/lib/env';

const OPENAI_URL = 'https://api.openai.com/v1';

const assertApiKey = () => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  return env.OPENAI_API_KEY;
};

export const callOpenAIResponses = async (body: Record<string, unknown>) => {
  const apiKey = assertApiKey();

  const response = await fetch(`${OPENAI_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Responses API failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as Record<string, unknown>;
};

export type OpenAIStreamHandlers = {
  onTextDelta?: (delta: string) => void;
  onCompleted?: (payload: Record<string, unknown>) => void;
};

export const streamOpenAIResponses = async (
  body: Record<string, unknown>,
  handlers: OpenAIStreamHandlers = {},
): Promise<Record<string, unknown>> => {
  const apiKey = assertApiKey();

  const response = await fetch(`${OPENAI_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenAI Responses API stream failed (${response.status}): ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completedPayload: Record<string, unknown> | null = null;

  const handleEvent = (event: Record<string, unknown>) => {
    const type = typeof event.type === 'string' ? event.type : '';

    if (type === 'response.output_text.delta') {
      const delta = typeof event.delta === 'string' ? event.delta : '';
      if (delta) handlers.onTextDelta?.(delta);
      return;
    }

    if (type === 'response.completed') {
      const responsePayload = event.response;
      if (responsePayload && typeof responsePayload === 'object') {
        completedPayload = responsePayload as Record<string, unknown>;
        handlers.onCompleted?.(completedPayload);
      }
    }
  };

  while (true) {
    const next = await reader.read();
    if (next.done) break;

    buffer += decoder.decode(next.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed === 'data: [DONE]') continue;

      const dataPrefix = 'data: ';
      if (!trimmed.startsWith(dataPrefix)) continue;

      try {
        const event = JSON.parse(trimmed.slice(dataPrefix.length)) as Record<string, unknown>;
        handleEvent(event);
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
  }

  if (!completedPayload) {
    throw new Error('OpenAI Responses API stream ended without a completed response.');
  }

  return completedPayload;
};

const collectOutputText = (node: unknown): string => {
  if (!node) return '';

  if (typeof node === 'string') return node;

  if (Array.isArray(node)) {
    return node.map((item) => collectOutputText(item)).join(' ').trim();
  }

  if (typeof node === 'object') {
    const objectNode = node as Record<string, unknown>;

    if (typeof objectNode.output_text === 'string') {
      return objectNode.output_text;
    }

    if (Array.isArray(objectNode.content)) {
      return objectNode.content
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            const contentEntry = entry as Record<string, unknown>;
            if (typeof contentEntry.text === 'string') return contentEntry.text;
            if (typeof contentEntry.output_text === 'string') return contentEntry.output_text;
          }
          return '';
        })
        .join(' ')
        .trim();
    }

    if (Array.isArray(objectNode.output)) {
      return collectOutputText(objectNode.output);
    }

    if (typeof objectNode.text === 'string') {
      return objectNode.text;
    }
  }

  return '';
};

export const extractResponsesText = (payload: Record<string, unknown>): string => {
  const outputText = typeof payload.output_text === 'string' ? payload.output_text : '';
  if (outputText) return outputText.trim();

  const parsed = collectOutputText(payload.output);
  return parsed.trim();
};