const getEnvModel = (key: string, fallback: string) => {
  const value = process.env[key]?.trim();
  return value || fallback;
};

/** Primary in-character chat + merged turn model (Dolphin Llama 3.1 family). */
export const VG_TOGETHER_CHAT_MODEL = getEnvModel(
  'VG_TOGETHER_CHAT_MODEL',
  'cognitivecomputations/dolphin-2.9.1-llama-3-8b',
);

/** Faster structured JSON tasks (persona, visual identity, intent fallback). */
export const VG_TOGETHER_FAST_MODEL = getEnvModel(
  'VG_TOGETHER_FAST_MODEL',
  'dolphin-2.5-mixtral-8x7b',
);

const LEGACY_MODEL_MAP: Record<string, string> = {
  'gpt-5-mini': VG_TOGETHER_CHAT_MODEL,
  'gpt-4o-mini': VG_TOGETHER_FAST_MODEL,
  'gpt-4o': VG_TOGETHER_CHAT_MODEL,
};

export const resolveVgTogetherModel = (requested?: string) => {
  if (!requested) return VG_TOGETHER_CHAT_MODEL;
  return LEGACY_MODEL_MAP[requested] ?? requested;
};