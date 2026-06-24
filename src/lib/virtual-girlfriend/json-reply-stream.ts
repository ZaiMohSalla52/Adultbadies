type ReplyStreamState = 'before_reply' | 'in_reply' | 'after_reply';

export class JsonReplyStreamExtractor {
  private buffer = '';
  private state: ReplyStreamState = 'before_reply';
  private escaped = false;
  private replyEmittedLength = 0;

  push(delta: string): string {
    this.buffer += delta;
    let emitted = '';

    if (this.state === 'before_reply') {
      const replyKeyIndex = this.buffer.indexOf('"reply"');
      if (replyKeyIndex === -1) return emitted;

      const colonIndex = this.buffer.indexOf(':', replyKeyIndex + '"reply"'.length);
      if (colonIndex === -1) return emitted;

      const openQuoteIndex = this.buffer.indexOf('"', colonIndex + 1);
      if (openQuoteIndex === -1) return emitted;

      this.state = 'in_reply';
      this.replyEmittedLength = openQuoteIndex + 1;
    }

    if (this.state === 'in_reply') {
      for (let i = this.replyEmittedLength; i < this.buffer.length; i += 1) {
        const char = this.buffer[i]!;

        if (this.escaped) {
          this.escaped = false;
          if (char === 'n') emitted += '\n';
          else if (char === 't') emitted += '\t';
          else if (char === 'r') emitted += '\r';
          else emitted += char;
          this.replyEmittedLength = i + 1;
          continue;
        }

        if (char === '\\') {
          this.escaped = true;
          this.replyEmittedLength = i + 1;
          continue;
        }

        if (char === '"') {
          this.state = 'after_reply';
          this.replyEmittedLength = i + 1;
          break;
        }

        emitted += char;
        this.replyEmittedLength = i + 1;
      }
    }

    return emitted;
  }

  getBuffer() {
    return this.buffer;
  }
}

export const tryParsePartialChatTurnIntent = <T extends Record<string, unknown>>(
  buffer: string,
  sanitize: (raw: Partial<T>, userMessage: string) => T,
  userMessage: string,
): T | null => {
  const replyIndex = buffer.indexOf('"reply"');
  const slice = replyIndex === -1 ? buffer : buffer.slice(0, replyIndex).replace(/,\s*$/, '');
  const candidate = `${slice}}`;

  try {
    const parsed = JSON.parse(candidate) as Partial<T>;
    return sanitize(parsed, userMessage);
  } catch {
    return null;
  }
};