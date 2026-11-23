import { embed, gateway } from 'ai';
import { waitUntil } from '@vercel/functions';
import { chatStatus, handleChat } from '../lib/chat.js';
import { loadConfig } from '../lib/config.js';
import { getSql } from '../lib/db.js';
import { checkBotId } from 'botid/server';
import { ChatLimits } from '../lib/limits.js';
import { RedisLimitStore, redisFromEnv } from '../lib/limits-redis.js';
import { retrieveWriting } from '../lib/retrieval.js';
import type { Config } from '../lib/config.js';

function createLimits(config: Config): ChatLimits | undefined {
  const redis = redisFromEnv();
  if (!redis) return undefined;
  if (!config.ipHashSalt) {
    console.error('chat: IP_HASH_SALT is not set; refusing to answer');
    return undefined;
  }
  return new ChatLimits(new RedisLimitStore(redis), { ...config, ipHashSalt: config.ipHashSalt }, isBot);
}

// Vercel BotID (Basic, free). The page loads /botid.js, which marks real browsers'
// requests to /api/chat. If the check itself fails, treat the request as a bot.
async function isBot(): Promise<boolean> {
  try {
    return (await checkBotId()).isBot;
  } catch (err) {
    console.error('chat: BotID check failed', err);
    return true;
  }
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
