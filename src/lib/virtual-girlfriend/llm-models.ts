const getEnvModel = (key: string, fallback: string) => {
  const value = process.env[key]?.trim();
  return value || fallback;
};

/** ModelsLab dedicated uncensored chat — flagship on /api/uncensored-chat. */
export const VG_MODELSLAB_DEFAULT_CHAT_MODEL = 'uncensored-chat';

export const VG_MODELSLAB_CHAT_MODEL = getEnvModel(
  'VG_MODELSLAB_CHAT_MODEL',
  VG_MODELSLAB_DEFAULT_CHAT_MODEL,
);

export const VG_MODELSLAB_FAST_MODEL = getEnvModel(
  'VG_MODELSLAB_FAST_MODEL',
  VG_MODELSLAB_DEFAULT_CHAT_MODEL,
);

export const VG_MODELSLAB_FALLBACK_MODELS = ['ModelsLab/Llama-3.1-8b-Uncensored-Dare'] as const;

export const resolveVgModelsLabModel = (requested?: string) => {
  if (!requested) return VG_MODELSLAB_CHAT_MODEL;
  return requested.trim() || VG_MODELSLAB_CHAT_MODEL;
};

export const buildModelsLabModelCandidates = (requested?: string) => {
  const primary = resolveVgModelsLabModel(requested);
  const ordered = [primary, ...VG_MODELSLAB_FALLBACK_MODELS];
  return [...new Set(ordered)];
};

/** Primary Together serverless model — DeepSeek V4 Pro. */
export const VG_TOGETHER_DEFAULT_CHAT_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';

/** Uncensored fallback when primary is unavailable or blocked for a turn. */
export const VG_TOGETHER_UNCENSORED_FALLBACK_MODEL = 'dolphin-2.5-mixtral-8x7b';

const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  'cognitivecomputations/dolphin-2.9.4-llama-3.1-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'cognitivecomputations/dolphin-2.9.1-llama-3-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'cognitivecomputations/dolphin-2.9-llama3-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'cognitivecomputations/dolphin-3.0-llama-3.1-8b': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'dolphin-2.5-mixtral-8x7b': VG_TOGETHER_UNCENSORED_FALLBACK_MODEL,
  'DeepSeek-V4-Pro': VG_TOGETHER_DEFAULT_CHAT_MODEL,
  'deepseek-v4-pro': VG_TOGETHER_DEFAULT_CHAT_MODEL,
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

/** Primary in-character chat + merged turn model. */
export const VG_TOGETHER_CHAT_MODEL = normalizeVgTogetherModel(
  getEnvModel('VG_TOGETHER_CHAT_MODEL', VG_TOGETHER_DEFAULT_CHAT_MODEL),
);

/** Structured JSON tasks (persona, visual identity, intent fallback). */
export const VG_TOGETHER_FAST_MODEL = normalizeVgTogetherModel(
  getEnvModel('VG_TOGETHER_FAST_MODEL', VG_TOGETHER_DEFAULT_CHAT_MODEL),
);

/** Ordered fallbacks when Together returns model_not_available. */
export const VG_TOGETHER_FALLBACK_MODELS = [
  VG_TOGETHER_UNCENSORED_FALLBACK_MODEL,
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

/** Active chat model — ModelsLab uncensored endpoint only. */
export const VG_CHAT_MODEL = VG_MODELSLAB_CHAT_MODEL;

/** Active fast/structured model (persona, visual identity JSON). */
export const VG_FAST_MODEL = VG_MODELSLAB_FAST_MODEL;