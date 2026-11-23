import { describe, expect, it, vi } from 'vitest';
import { costUsd, estimateCostUsd, gatewayPriceLookup, type Prices } from '../lib/pricing.js';

const usage = (input: number, cacheRead: number, cacheWrite: number, output: number) => ({
  inputTokens: input,
  inputTokenDetails: { noCacheTokens: input - cacheRead - cacheWrite, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite },
  outputTokens: output,
  outputTokenDetails: { textTokens: output, reasoningTokens: 0 },
  totalTokens: input + output,
});

// Shaped like gateway.getAvailableModels(): USD per token, as strings.
const MODELS = {
  models: [
    {
      id: 'anthropic/claude-haiku-5.5',
      pricing: { input: '0.0000001', output: '0.0000005', cachedInputTokens: '0.00000001', cacheCreationInputTokens: '0.000000125' },
    },
    { id: 'openai/no-cache-model', pricing: { input: '0.000001', output: '0.000002' } },
    { id: 'someone/free-preview', pricing: null },
  ],
};
const HAIKU: Prices = { input: 1e-7, cacheRead: 1e-8, cacheWrite: 1.25e-7, output: 5e-7 };

describe('gatewayPriceLookup', () => {
  it("reads per-token prices from the gateway's model list", async () => {
    const lookup = gatewayPriceLookup(async () => MODELS);
    expect(await lookup('anthropic/claude-haiku-5.5')).toEqual(HAIKU);
    // No cache prices listed: cached tokens cost the same as input.
    expect(await lookup('openai/no-cache-model')).toEqual({ input: 1e-6, cacheRead: 1e-6, cacheWrite: 1e-6, output: 2e-6 });
    expect(await lookup('someone/free-preview')).toBeUndefined();
    expect(await lookup('someone/unknown')).toBeUndefined();
  });

  it('fetches once an hour and keeps the last prices if a refresh fails', async () => {
    let now = 0;
    const fetchModels = vi.fn(async () => MODELS);
    const lookup = gatewayPriceLookup(fetchModels, () => now);
    await Promise.all([lookup('anthropic/claude-haiku-5.5'), lookup('anthropic/claude-haiku-5.5')]);
    now = 30 * 60 * 1000;
    await lookup('anthropic/claude-haiku-5.5');
    expect(fetchModels).toHaveBeenCalledTimes(1);

    now = 2 * 60 * 60 * 1000;
    fetchModels.mockRejectedValueOnce(new Error('gateway down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await lookup('anthropic/claude-haiku-5.5')).toEqual(HAIKU);
    expect(fetchModels).toHaveBeenCalledTimes(2);
  });
});

describe('estimateCostUsd', () => {
  it('prices each kind of token', () => {
    // 200 uncached input, 3000 cache reads, 300 output
    expect(estimateCostUsd(HAIKU, usage(3200, 3000, 0, 300))).toBeCloseTo(200 * 1e-7 + 3000 * 1e-8 + 300 * 5e-7, 12);
  });

  it('prices unknown models high so the daily cap stays safe', () => {
    expect(estimateCostUsd(undefined, usage(1000, 0, 0, 100))).toBeGreaterThan(
      estimateCostUsd(HAIKU, usage(1000, 0, 0, 100)) * 10,
    );
  });
});

describe('costUsd', () => {
  it('prefers the cost the gateway reports, then live prices', async () => {
    const lookup = vi.fn(async () => HAIKU);
    expect(await costUsd('anthropic/claude-haiku-5.5', usage(10, 0, 0, 10), { gateway: { cost: '0.0123' } }, lookup)).toBe(0.0123);
    expect(lookup).not.toHaveBeenCalled();
    expect(await costUsd('anthropic/claude-haiku-5.5', usage(10, 0, 0, 10), { gateway: { cost: 'n/a' } }, lookup)).toBeCloseTo(
      10 * 1e-7 + 10 * 5e-7,
      12,
    );
  });
});
