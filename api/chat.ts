import { embed, gateway } from 'ai';
import { waitUntil } from '@vercel/functions';
import { chatStatus, handleChat } from '../lib/chat.js';
import { loadConfig } from '../lib/config.js';
import { getSql } from '../lib/db.js';
import { ChatLimits, missingLimitSetting } from '../lib/limits.js';
import { RedisLimitStore, redisFromEnv } from '../lib/limits-redis.js';
import { retrieveWriting } from '../lib/retrieval.js';
import { createTurnstileVerifier } from '../lib/turnstile.js';
import type { Config } from '../lib/config.js';

function createLimits(config: Config): ChatLimits | undefined {
  const redis = redisFromEnv();
  if (!redis) return undefined;
  const missing = missingLimitSetting(config);
  if (missing || !config.ipHashSalt) {
    console.error(`chat: ${missing} is not set; refusing to answer`);
    return undefined;
  }
  const verifier =
    config.turnstileSecretKey && config.turnstileVerifyUrl
      ? createTurnstileVerifier(config.turnstileSecretKey, config.turnstileVerifyUrl)
      : undefined;
  return new ChatLimits(new RedisLimitStore(redis), { ...config, ipHashSalt: config.ipHashSalt }, verifier);
}

// GET /api/chat: whether the chat panel should show. POST /api/chat: ask a question.
export async function GET(): Promise<Response> {
  const config = loadConfig();
  return chatStatus(config, createLimits(config));
}

export async function POST(request: Request): Promise<Response> {
  const config = loadConfig();
  const sql = getSql(config.databaseUrl);
  return handleChat(request, {
    config,
    sql,
    getModel: (modelId) => gateway(modelId),
    limits: createLimits(config),
    waitUntil,
    retrieve:
      config.ragEnabled && sql
        ? (question) =>
            retrieveWriting(question, {
              sql,
              topK: config.ragTopK,
              embed: async (value) =>
                (await embed({ model: gateway.embeddingModel(config.embeddingModel), value })).embedding,
            })
        : undefined,
  });
}
