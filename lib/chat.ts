import { streamText, type LanguageModel, type LanguageModelUsage, type ModelMessage } from 'ai';
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import type { Config } from './config.js';
import type { Sql } from './db.js';
import { loadHistory, saveExchange, type ChatRecord } from './history.js';
import type { ChatLimits } from './limits.js';
import { costUsd, estimateCostUsd, type PriceLookup } from './pricing.js';
import { readProfile } from './profile.js';
import { buildSystemPrompt, buildUserContent } from './prompt.js';
import { ERROR_MESSAGES } from './constants/messages.js';
import { EVENT_TYPES, PART_TYPES, type StreamEvent } from './constants/stream.js';
import { ERRORS, errorResponse, upstreamError } from './errors.js';
import { validateChatRequest } from './validation.js';

export type ChatDeps = {
  config: Config;
  sql: Sql | undefined;
  getModel: (modelId: string) => LanguageModel;
  // Rate, turn, and spend limits. Without them the chat refuses to run.
  limits: ChatLimits | undefined;
  // Keeps the function alive for work that finishes after the response (Vercel waitUntil).
  waitUntil: (promise: Promise<unknown>) => void;
  retrieve?: ((question: string) => Promise<string | undefined>) | undefined;
  // Current model prices, for when the gateway doesn't report a request's cost.
  prices?: PriceLookup | undefined;
  profile?: string;
  now?: () => number;
};

const NDJSON_HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

// Tells the page whether to show the panel. Cached for a minute at the edge.
export async function chatStatus(config: Config, limits: ChatLimits | undefined): Promise<Response> {
  const enabled = config.chatEnabled && limits !== undefined;
  let resting = false;
  if (enabled) {
    try {
      resting = await limits.isResting();
    } catch (err) {
      console.error('chat: could not read the spend counter', err);
    }
  }
  return Response.json(
    { enabled, resting, turnstileSiteKey: enabled && config.turnstileSecretKey ? config.turnstileSiteKey : undefined },
    { headers: { 'cache-control': 'public, max-age=60, s-maxage=60' } },
  );
}

// A rough cost for answers that stopped early, when the model reported no usage.
async function roughCostUsd(
  modelId: string,
  lookup: PriceLookup | undefined,
  promptChars: number,
  answerChars: number,
): Promise<number> {
  const input = Math.ceil(promptChars / 3.5);
  const output = Math.ceil(answerChars / 3.5);
  return estimateCostUsd(await lookup?.(modelId), {
    inputTokens: input,
    inputTokenDetails: { noCacheTokens: input, cacheReadTokens: 0, cacheWriteTokens: 0 },
    outputTokens: output,
    outputTokenDetails: { textTokens: output, reasoningTokens: 0 },
    totalTokens: input + output,
  });
}

export async function handleChat(request: Request, deps: ChatDeps): Promise<Response> {
  const { config } = deps;
  const now = deps.now ?? Date.now;
  if (!config.chatEnabled) return errorResponse(ERRORS.Disabled);

  if (!deps.limits) {
    console.error('chat: limits store is not configured (Upstash Redis); refusing to answer');
    return errorResponse(ERRORS.Disabled);
  }
  const limits = deps.limits;

  const validated = await validateChatRequest(request, config.maxInputChars);
  if (!validated.ok) return errorResponse(validated.error);
  const { sessionId, message, turnstileToken } = validated.value;

  const blocked = await limits.check({ request, sessionId, turnstileToken });
  if (blocked) return blocked;

  const [history, writing] = await Promise.all([
    deps.sql ? loadHistory(deps.sql, sessionId, config.historyTurns) : Promise.resolve([]),
    config.ragEnabled && deps.retrieve ? deps.retrieve(message) : Promise.resolve(undefined),
  ]);
  const messages: ModelMessage[] = [...history, { role: 'user', content: buildUserContent(message, writing) }];

  const system = buildSystemPrompt(deps.profile ?? readProfile());
  const promptChars = system.length + JSON.stringify(messages).length;
  const spend = (usd: number) =>
    limits.recordSpend(usd).catch((err: unknown) => console.error('chat: failed to record spend', err));

  const started = now();
  const abort = new AbortController();
  request.signal?.addEventListener('abort', () => abort.abort(), { once: true });

  const result = streamText({
    model: deps.getModel(config.chatModel),
    system,
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
  const record = async (status: ChatRecord['status'], usage?: LanguageModelUsage, cost?: number) => {
    if (!deps.sql) return;
    await saveExchange(deps.sql, {
      sessionId,
      question: message,
      answer,
      status,
      model: config.chatModel,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      cacheReadTokens: usage?.inputTokenDetails.cacheReadTokens,
      costUsd: cost,
      latencyMs: now() - started,
    }).catch((err: unknown) => console.error('chat: failed to save message', err));
  };

  // Prices the answer, adds it to the day's spend, and saves the exchange.
  // Runs after the response ends, so a slow price lookup never holds up the answer.
  const settle = async (status: ChatRecord['status']) => {
    const finished =
      status === 'ok'
        ? await Promise.all([result.totalUsage, result.providerMetadata]).catch(() => undefined)
        : undefined;
    const cost = finished
      ? await costUsd(config.chatModel, finished[0], finished[1], deps.prices)
      : await roughCostUsd(config.chatModel, deps.prices, promptChars, answer.length);
    await Promise.all([spend(cost), record(status, finished?.[0], cost)]);
  };

  // Wait for the first piece of text before answering, so a failure up front
  // (bad key, used-up budget) becomes a clear error instead of an empty stream.
  const parts = result.fullStream[Symbol.asyncIterator]();
  let firstText: string | undefined;
  for (;;) {
    const next = await parts.next();
    if (next.done) break;
    const part = next.value;
    if (part.type === PART_TYPES.Delta) {
      firstText = part.text;
      break;
    }
    if (part.type === PART_TYPES.Error) {
      console.error('chat: model error before first token', part.error);
      deps.waitUntil(record('error'));
      return errorResponse(upstreamError(part.error));
    }
    if (part.type === PART_TYPES.Abort) {
      deps.waitUntil(record('aborted'));
      return errorResponse(ERRORS.Aborted);
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
          send({ type: EVENT_TYPES.Text, text: firstText });
        }
        for (;;) {
          const next = await parts.next();
          if (next.done) break;
          const part = next.value;
          if (part.type === PART_TYPES.Delta) {
            answer += part.text;
            send({ type: EVENT_TYPES.Text, text: part.text });
          } else if (part.type === PART_TYPES.Error) {
            console.error('chat: model error mid-stream', part.error);
            status = 'error';
            send({ type: EVENT_TYPES.Error, message: ERROR_MESSAGES.CutOff });
            break;
          } else if (part.type === PART_TYPES.Abort) {
            status = 'aborted';
            break;
          }
        }
        if (status === 'ok') send({ type: EVENT_TYPES.Done });
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
      deps.waitUntil(settle(status));
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body, { headers: NDJSON_HEADERS });
}
