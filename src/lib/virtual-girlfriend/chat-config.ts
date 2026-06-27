/** Recent messages included in the chat LLM request. */
export const VG_CHAT_HISTORY_WINDOW = 24;

/** Messages fetched before each chat turn (window + small buffer for intent heuristics). */
export const VG_CHAT_HISTORY_FETCH_LIMIT = VG_CHAT_HISTORY_WINDOW + 6;

/** Memories retrieved per turn. */
export const VG_CHAT_MEMORY_RETRIEVAL_LIMIT = 10;

/** Max memories loaded before lexical/vector ranking. */
export const VG_CHAT_MEMORY_POOL_LIMIT = 50;

/** Skip query embedding for very short messages (saves a round-trip). */
export const VG_CHAT_EMBEDDING_MIN_QUERY_LENGTH = 8;