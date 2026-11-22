import type { LanguageModelUsage } from 'ai';

// USD per million tokens, from the providers' list prices (AI Gateway adds no markup).
// Used to track daily spend when the gateway doesn't report a cost itself.
type Prices = { input: number; cacheRead: number; cacheWrite: number; output: number };

const PRICES: Record<string, Prices> = {
  'anthropic/claude-haiku-5.5': { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 },
  'openai/gpt-6-luna': { input: 0.1, cacheRead: 0.01, cacheWrite: 0.1, output: 0.5 },
};

// Unknown models are priced high on purpose, so the daily cap errs on the safe side.
const FALLBACK: Prices = { input: 5, cacheRead: 5, cacheWrite: 5, output: 25 };

export function estimateCostUsd(modelId: string, usage: LanguageModelUsage): number {
  const p = PRICES[modelId] ?? FALLBACK;
  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0;
  const noCache = usage.inputTokenDetails.noCacheTokens ?? Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite);
  const output = usage.outputTokens ?? 0;
  return (noCache * p.input + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite + output * p.output) / 1_000_000;
}

// Prefers the cost AI Gateway reports in provider metadata; falls back to the price table.
export function costUsd(
  modelId: string,
  usage: LanguageModelUsage,
  providerMetadata: Record<string, Record<string, unknown> | undefined> | undefined,
): number {
  const reported = Number(providerMetadata?.gateway?.cost);
  return Number.isFinite(reported) && reported > 0 ? reported : estimateCostUsd(modelId, usage);
}
