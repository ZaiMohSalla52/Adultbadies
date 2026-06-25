/** Pace streamed assistant text so replies feel human, not instant. */
export const createChatReplyPacer = (emit: (chunk: string) => void) => {
  const thinkMs = 900 + Math.floor(Math.random() * 550);
  const charMs = 28;
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
    started = true;
    emit(char);

    timer = setTimeout(pump, charMs);
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(pump, started ? charMs : thinkMs);
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