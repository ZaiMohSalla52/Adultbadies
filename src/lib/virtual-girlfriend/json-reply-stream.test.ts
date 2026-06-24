import { describe, expect, it } from 'vitest';
import { JsonReplyStreamExtractor, tryParsePartialChatTurnIntent } from '@/lib/virtual-girlfriend/json-reply-stream';
import { sanitizeIntent } from '@/lib/virtual-girlfriend/intimacy-intent';

describe('JsonReplyStreamExtractor', () => {
  it('streams reply characters from structured JSON deltas', () => {
    const extractor = new JsonReplyStreamExtractor();
    const chunks = [
      '{"intimacyActive":true,"wantsPhoto":false,"photoDelivery":"none","visualSceneHint":null,',
      '"imageCategory":"selfie","powerDynamic":"balanced","companionGuidance":"Stay warm.",',
      '"reply":"Hey you',
      ' 😘\\n\\nMiss me?"}',
    ];

    const emitted = chunks.map((chunk) => extractor.push(chunk)).join('');
    expect(emitted).toBe('Hey you 😘\n\nMiss me?');
  });
});

describe('tryParsePartialChatTurnIntent', () => {
  it('parses intent fields before reply is complete', () => {
    const buffer =
      '{"intimacyActive":true,"wantsPhoto":true,"photoDelivery":"send_now","visualSceneHint":"mirror selfie","imageCategory":"selfie","powerDynamic":"balanced","companionGuidance":"Flirt and deliver."';

    const intent = tryParsePartialChatTurnIntent(buffer, sanitizeIntent, 'send me a selfie');
    expect(intent?.wantsPhoto).toBe(true);
    expect(intent?.photoDelivery).toBe('send_now');
  });
});