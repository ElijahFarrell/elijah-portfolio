// Server-side settings for the chat, read from environment variables.
// Every value has a safe default so a missing variable never takes the site down.

function floatFromEnv(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function intFromEnv(name: string, fallback: number, env: NodeJS.ProcessEnv): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export type Config = {
  databaseUrl: string | undefined;
  cronSecret: string | undefined;
  retentionDays: number;
  // Master switch. The panel stays hidden and the API refuses until this is "true".
  chatEnabled: boolean;
  // AI Gateway model ID, e.g. anthropic/claude-haiku-5.5 or openai/gpt-6-luna.
  chatModel: string;
  maxInputChars: number;
  maxOutputTokens: number;
  // How many earlier question/answer pairs from the session to send with each question.
  historyTurns: number;
  // Retrieval over content_chunks (Substack, advice). Off until that table is filled.
  ragEnabled: boolean;
  embeddingModel: string;
  ragTopK: number;
  // Limits. Questions per visitor (hashed IP) per sliding window.
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
  // Questions per chat session before "Clear chat" is needed.
  sessionMaxTurns: number;
  // Once the day's spend (UTC) reaches this, the chat rests until tomorrow.
  dailyBudgetUsd: number;
  // Salt for hashing visitor IPs before they're used as rate-limit keys.
  ipHashSalt: string;
  // Cloudflare Turnstile. When the secret is set, each new session must pass a check.
  turnstileSiteKey: string | undefined;
  turnstileSecretKey: string | undefined;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    databaseUrl: env.DATABASE_URL || undefined,
    cronSecret: env.CRON_SECRET || undefined,
    retentionDays: Math.max(1, intFromEnv('RETENTION_DAYS', 90, env)),
    chatEnabled: env.CHAT_ENABLED === 'true',
    chatModel: env.CHAT_MODEL || 'anthropic/claude-haiku-5.5',
    maxInputChars: Math.max(1, intFromEnv('CHAT_MAX_INPUT_CHARS', 4000, env)),
    maxOutputTokens: Math.max(1, intFromEnv('CHAT_MAX_OUTPUT_TOKENS', 400, env)),
    historyTurns: intFromEnv('CHAT_HISTORY_TURNS', 6, env),
    ragEnabled: env.RAG_ENABLED === 'true',
    embeddingModel: env.EMBEDDING_MODEL || 'openai/text-embedding-3-small',
    ragTopK: Math.max(1, intFromEnv('RAG_TOP_K', 4, env)),
    rateLimitMax: Math.max(1, intFromEnv('RATE_LIMIT_MAX', 10, env)),
    rateLimitWindowSeconds: Math.max(1, intFromEnv('RATE_LIMIT_WINDOW_SECONDS', 600, env)),
    sessionMaxTurns: Math.max(1, intFromEnv('SESSION_MAX_TURNS', 20, env)),
    dailyBudgetUsd: floatFromEnv('DAILY_BUDGET_USD', 3, env),
    ipHashSalt: env.IP_HASH_SALT || 'elijahvfg-chat',
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || undefined,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY || undefined,
  };
}
