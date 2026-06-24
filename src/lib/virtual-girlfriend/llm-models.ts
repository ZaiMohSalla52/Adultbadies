const getEnvModel = (key: string, fallback: string) => {
  const value = process.env[key]?.trim();
  return value || fallback;
};

/**
 * Verified on Together serverless (short-form id).
 * Many cognitivecomputations/dolphin-* Llama 3.1 ids are NOT hosted there.
 */
export const VG_TOGETHER_DEFAULT_CHAT_MODEL = 'dolphin-2.5-mixtral-8x7b';

const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  'cognitivecomputations/dolphin-2.9.4-llama-3.1-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'cognitivecomputations/dolphin-2.9.1-llama-3-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'cognitivecomputations/dolphin-2.9-llama3-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'cognitivecomputations/dolphin-3.0-llama-3.1-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
};

export function normalizeVgTogetherModel(model: string) {
  const trimmed = model.trim();
  if (!trimmed) return VG_TOGETHER_DEFAULT_CHAT_MODEL;

  if (DEPRECATED_MODEL_ALIASES[trimmed]) {
    return DEPRECATED_MODEL_ALIASES[trimmed]!;
  }

  if (/cognitivecomputations\/dolphin.*llama.*3\.1/i.test(trimmed)) {
    return VG_TOGETHER_DEFAULT_CHAT_MODEL;
  }

  if (/cognitivecomputations\/dolphin-2\.9/i.test(trimmed)) {
    return VG_TOGETHER_DEFAULT_CHAT_MODEL;
  }

  return trimmed;
}

/** Primary in-character chat + merged turn model (uncensored Dolphin Mixtral). */
export const VG_TOGETHER_CHAT_MODEL = normalizeVgTogetherModel(
  getEnvModel('VG_TOGETHER_CHAT_MODEL', VG_TOGETHER_DEFAULT_CHAT_MODEL),
);

/** Structured JSON tasks (persona, visual identity, intent fallback). */
export const VG_TOGETHER_FAST_MODEL = normalizeVgTogetherModel(
  getEnvModel('VG_TOGETHER_FAST_MODEL', VG_TOGETHER_DEFAULT_CHAT_MODEL),
);

/** Ordered fallbacks when Together returns model_not_available. */
export const VG_TOGETHER_FALLBACK_MODELS = [
  VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'meta-llama/Llama-3.3-70B-Instruct-Turbo',
] as const;

const LEGACY_MODEL_MAP: Record<string, string> = {
  'gpt-5-mini': VG_TOGETHER_CHAT_MODEL,
  'gpt-4o-mini': VG_TOGETHER_FAST_MODEL,
  'gpt-4o': VG_TOGETHER_CHAT_MODEL,
};

export const resolveVgTogetherModel = (requested?: string) => {
  if (!requested) return VG_TOGETHER_CHAT_MODEL;
  return normalizeVgTogetherModel(LEGACY_MODEL_MAP[requested] ?? requested);
};

export const buildTogetherModelCandidates = (requested?: string) => {
  const primary = resolveVgTogetherModel(requested);
  const ordered = [primary, ...VG_TOGETHER_FALLBACK_MODELS];
  return [...new Set(ordered)];
};