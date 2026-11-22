import { embed, gateway } from 'ai';
import { waitUntil } from '@vercel/functions';
import { chatStatus, handleChat } from '../lib/chat.js';
import { loadConfig } from '../lib/config.js';
import { getSql } from '../lib/db.js';
import { retrieveWriting } from '../lib/retrieval.js';

// GET /api/chat: whether the chat panel should show. POST /api/chat: ask a question.
export function GET(): Response {
  return chatStatus(loadConfig());
}

export async function POST(request: Request): Promise<Response> {
  const config = loadConfig();
  const sql = getSql(config.databaseUrl);
  return handleChat(request, {
    config,
    sql,
    getModel: (modelId) => gateway(modelId),
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
