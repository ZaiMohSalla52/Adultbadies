/** Delay before the first character appears (after the model has finished). */
export const computeThinkDelayMs = () => 500 + Math.floor(Math.random() * 400);

/** Pause between separate chat bubbles, like a real person sending multiple texts. */
export const computeSegmentPauseMs = () => 1200 + Math.floor(Math.random() * 1300);

const computeCharDelayMs = (char: string) => {
  if (/[.!?]/.test(char)) return 320 + Math.floor(Math.random() * 280);
  if (/[,;]/.test(char)) return 140 + Math.floor(Math.random() * 100);
  if (char === ':') return 100 + Math.floor(Math.random() * 60);
  if (char === '\n') return 450 + Math.floor(Math.random() * 350);
  if (char === ' ') return 48 + Math.floor(Math.random() * 32);
  return 42 + Math.floor(Math.random() * 38);
};

export type ChatReplyPacerOptions = {
  /** Override initial think delay (0 skips the pre-typing pause). */
  thinkMs?: number;
  onEmitStart?: () => void;
};

/** Pace streamed assistant text so replies feel human, not instant. */
export const createChatReplyPacer = (
  emit: (chunk: string) => void,
  options?: ChatReplyPacerOptions,
) => {
  const thinkMs = options?.thinkMs ?? computeThinkDelayMs();
  let queue = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let started = false;
  let flushResolve: (() => void) | null = null;

  const finishFlush = () => {
    if (queue.length || timer) return;
    flushResolve?.();
    flushResolve = null;
  };

  const pump = () => {
    timer = null;
    if (!queue.length) {
      finishFlush();
      return;
    }

    const char = queue.charAt(0);
    queue = queue.slice(1);
    if (!started) {
      started = true;
      options?.onEmitStart?.();
    }
    emit(char);

    timer = setTimeout(pump, computeCharDelayMs(char));
  };

  const schedule = () => {
    if (timer) return;
    const delay = started ? computeCharDelayMs(queue.charAt(0)) : thinkMs;
    timer = setTimeout(pump, delay);
  };

  return {
    push(chunk: string) {
      if (!chunk) return;
      queue += chunk;
      schedule();
    },
    flush(): Promise<void> {
      if (!queue.length && !timer) return Promise.resolve();
      return new Promise((resolve) => {
        flushResolve = resolve;
        if (!timer) schedule();
      });
    },
    reset() {
      if (timer) clearTimeout(timer);
      queue = '';
      timer = null;
      started = false;
      flushResolve = null;
    },
  };
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));