// Server-side settings for the chat, read from environment variables.
// Every value has a safe default so a missing variable never takes the site down.

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
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    databaseUrl: env.DATABASE_URL || undefined,
    cronSecret: env.CRON_SECRET || undefined,
    retentionDays: Math.max(1, intFromEnv('RETENTION_DAYS', 90, env)),
  };
}
