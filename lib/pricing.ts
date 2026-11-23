import type { LanguageModelUsage } from 'ai';

// USD per token.
export type Prices = { input: number; cacheRead: number; cacheWrite: number; output: number };

// Finds a model's current prices; undefined when the model is unknown or the lookup failed.
export type PriceLookup = (modelId: string) => Promise<Prices | undefined>;

// The parts of AI Gateway's model list (gateway.getAvailableModels) that carry prices.
type ModelList = {
  models: {
    id: string;
    pricing?: { input: string; output: string; cachedInputTokens?: string; cacheCreationInputTokens?: string } | null;
  }[];
};

// Used when no price is known. High on purpose, so the daily cap errs on the safe side.
const FALLBACK: Prices = { input: 5e-6, cacheRead: 5e-6, cacheWrite: 5e-6, output: 25e-6 };

const PRICE_TTL_MS = 60 * 60 * 1000;

function toPrices(list: ModelList): Map<string, Prices> {
  const prices = new Map<string, Prices>();
  for (const { id, pricing } of list.models) {
    if (!pricing) continue;
    const input = Number(pricing.input);
    const output = Number(pricing.output);
    if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
    const cacheRead = Number(pricing.cachedInputTokens ?? input);
    const cacheWrite = Number(pricing.cacheCreationInputTokens ?? input);
    prices.set(id, {
      input,
      output,
      cacheRead: Number.isFinite(cacheRead) ? cacheRead : input,
      cacheWrite: Number.isFinite(cacheWrite) ? cacheWrite : input,
    });
  }
  return prices;
}

// Live prices from AI Gateway's model list, fetched at most once an hour per instance.
// If a refresh fails, the last prices it got keep being used.
export function gatewayPriceLookup(fetchModels: () => Promise<ModelList>, now: () => number = Date.now): PriceLookup {
  let cached: { at: number; prices: Map<string, Prices> } | undefined;
  let loading: Promise<Map<string, Prices>> | undefined;
  return async (modelId) => {
    if (!cached || now() - cached.at > PRICE_TTL_MS) {
      loading ??= fetchModels()
        .then(toPrices)
        .finally(() => (loading = undefined));
      try {
        cached = { at: now(), prices: await loading };
      } catch (err) {
        console.error('chat: could not load AI Gateway prices', err);
      }
    }
    return cached?.prices.get(modelId);
  };
}

export function estimateCostUsd(prices: Prices | undefined, usage: LanguageModelUsage): number {
  const p = prices ?? FALLBACK;
  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0;
  const noCache = usage.inputTokenDetails.noCacheTokens ?? Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite);
  const output = usage.outputTokens ?? 0;
  return noCache * p.input + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite + output * p.output;
}

// Prefers the cost AI Gateway reports for the request; otherwise prices the usage
// with the gateway's current list prices.
export async function costUsd(
  modelId: string,
  usage: LanguageModelUsage,
  providerMetadata: Record<string, Record<string, unknown> | undefined> | undefined,
  lookup: PriceLookup | undefined,
): Promise<number> {
  const reported = Number(providerMetadata?.gateway?.cost);
  if (Number.isFinite(reported) && reported > 0) return reported;
  return estimateCostUsd(await lookup?.(modelId), usage);
}
