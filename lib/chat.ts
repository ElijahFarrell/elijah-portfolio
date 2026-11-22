import { streamText, type LanguageModel, type LanguageModelUsage, type ModelMessage } from 'ai';
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import type { Config } from './config.js';
import type { Sql } from './db.js';
import { loadHistory, saveExchange, type ChatRecord } from './history.js';
import { costUsd } from './pricing.js';
import { readProfile } from './profile.js';
import { buildSystemPrompt, buildUserContent } from './prompt.js';
import { isSameOrigin, parseChatRequest } from './request.js';

export type ChatDeps = {
  config: Config;
  sql: Sql | undefined;
  getModel: (modelId: string) => LanguageModel;
  // Keeps the function alive for work that finishes after the response (Vercel waitUntil).
  waitUntil: (promise: Promise<unknown>) => void;
  retrieve?: ((question: string) => Promise<string | undefined>) | undefined;
  profile?: string;
  now?: () => number;
};

// Response body: one JSON object per line (NDJSON).
//   {"type":"text","text":"..."}  a piece of the answer
//   {"type":"error","message":"..."}  the answer stopped early
//   {"type":"done"}  the answer is complete
export type StreamEvent = { type: 'text'; text: string } | { type: 'error'; message: string } | { type: 'done' };

const NDJSON_HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function jsonError(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status, headers: { 'cache-control': 'no-store' } });
}

export function chatStatus(config: Config): Response {
  return Response.json(
    { enabled: config.chatEnabled },
    { headers: { 'cache-control': 'public, max-age=60, s-maxage=60' } },
  );
}

function upstreamError(error: unknown): Response {
  const status = (error as { statusCode?: number } | undefined)?.statusCode;
  // 402: the AI Gateway budget on the API key is used up.
  if (status === 402) return jsonError(503, 'resting', 'The chat is resting for today. Please try again tomorrow.');
  if (status === 429) return jsonError(503, 'busy', 'The chat is busy right now. Please try again in a minute.');
  return jsonError(502, 'upstream', 'Something went wrong. Please try again.');
}

export async function handleChat(request: Request, deps: ChatDeps): Promise<Response> {
  const { config } = deps;
  const now = deps.now ?? Date.now;
  if (!config.chatEnabled) return jsonError(503, 'disabled', "The chat isn't available right now.");
  if (!isSameOrigin(request)) return jsonError(403, 'forbidden', 'Not allowed.');

  const parsed = await parseChatRequest(request, config.maxInputChars);
  if (!parsed.ok) return jsonError(parsed.status, parsed.error, parsed.message);
  const { sessionId, message } = parsed;

  const [history, writing] = await Promise.all([
    deps.sql ? loadHistory(deps.sql, sessionId, config.historyTurns) : Promise.resolve([]),
    config.ragEnabled && deps.retrieve ? deps.retrieve(message) : Promise.resolve(undefined),
  ]);
  const messages: ModelMessage[] = [...history, { role: 'user', content: buildUserContent(message, writing) }];

  const started = now();
  const abort = new AbortController();
  request.signal?.addEventListener('abort', () => abort.abort(), { once: true });

  const result = streamText({
    model: deps.getModel(config.chatModel),
    system: buildSystemPrompt(deps.profile ?? readProfile()),
    messages,
    maxOutputTokens: config.maxOutputTokens,
    maxRetries: 1,
    abortSignal: abort.signal,
    providerOptions: {
      // Caches the long, unchanging system prompt across requests.
      gateway: { caching: 'auto' },
      // Short factual answers don't need extended reasoning; skipping it is faster and cheaper.
      anthropic: { thinking: { type: 'disabled' }, effort: 'low' } satisfies AnthropicLanguageModelOptions,
    },
  });

  let answer = '';
  const record = (status: ChatRecord['status'], usage?: LanguageModelUsage, cost?: number) => {
    if (!deps.sql) return;
    const sql = deps.sql;
    deps.waitUntil(
      saveExchange(sql, {
        sessionId,
        question: message,
        answer,
        status,
        model: config.chatModel,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        cacheReadTokens: usage?.inputTokenDetails.cacheReadTokens,
        cacheWriteTokens: usage?.inputTokenDetails.cacheWriteTokens,
        costUsd: cost,
        latencyMs: now() - started,
      }).catch((err: unknown) => console.error('chat: failed to save message', err)),
    );
  };

  // Wait for the first piece of text before answering, so a failure up front
  // (bad key, used-up budget) becomes a clear error instead of an empty stream.
  const parts = result.fullStream[Symbol.asyncIterator]();
  let firstText: string | undefined;
  for (;;) {
    const next = await parts.next();
    if (next.done) break;
    const part = next.value;
    if (part.type === 'text-delta') {
      firstText = part.text;
      break;
    }
    if (part.type === 'error') {
      console.error('chat: model error before first token', part.error);
      record('error');
      return upstreamError(part.error);
    }
    if (part.type === 'abort') {
      record('aborted');
      return jsonError(499, 'aborted', 'Request cancelled.');
    }
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let status: ChatRecord['status'] = 'ok';
      try {
        if (firstText !== undefined) {
          answer += firstText;
          send({ type: 'text', text: firstText });
        }
        for (;;) {
          const next = await parts.next();
          if (next.done) break;
          const part = next.value;
          if (part.type === 'text-delta') {
            answer += part.text;
            send({ type: 'text', text: part.text });
          } else if (part.type === 'error') {
            console.error('chat: model error mid-stream', part.error);
            status = 'error';
            send({ type: 'error', message: 'The answer was cut off. Please try again.' });
            break;
          } else if (part.type === 'abort') {
            status = 'aborted';
            break;
          }
        }
        if (status === 'ok') send({ type: 'done' });
        controller.close();
      } catch (err) {
        status = abort.signal.aborted ? 'aborted' : 'error';
        if (status === 'error') console.error('chat: stream failed', err);
        try {
          controller.close();
        } catch {
          // Already closed by a cancelled reader.
        }
      }

      if (status !== 'ok') return record(status);
      try {
        const [usage, providerMetadata] = await Promise.all([result.totalUsage, result.providerMetadata]);
        record('ok', usage, costUsd(config.chatModel, usage, providerMetadata));
      } catch {
        record('ok');
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body, { headers: NDJSON_HEADERS });
}
