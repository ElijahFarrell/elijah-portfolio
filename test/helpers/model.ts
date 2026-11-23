import { APICallError, simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

type Usage = { input: number; cacheRead?: number; cacheWrite?: number; output: number };

// A fake model that streams `chunks` as the answer, then reports usage.
export function mockModel(chunks: string[], opts: { usage?: Usage; cost?: string; failMidStream?: boolean } = {}) {
  const usage = opts.usage ?? { input: 1200, cacheRead: 1000, cacheWrite: 0, output: 40 };
  return new MockLanguageModelV4({
    modelId: 'mock',
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 't' },
          ...chunks.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
          ...(opts.failMidStream
            ? [{ type: 'error' as const, error: new Error('connection reset') }]
            : [
                { type: 'text-end' as const, id: 't' },
                {
                  type: 'finish' as const,
                  finishReason: { unified: 'stop' as const, raw: 'end_turn' },
                  usage: {
                    inputTokens: {
                      total: usage.input,
                      noCache: usage.input - (usage.cacheRead ?? 0) - (usage.cacheWrite ?? 0),
                      cacheRead: usage.cacheRead ?? 0,
                      cacheWrite: usage.cacheWrite ?? 0,
                    },
                    outputTokens: { total: usage.output, text: usage.output, reasoning: 0 },
                  },
                  ...(opts.cost ? { providerMetadata: { gateway: { cost: opts.cost } } } : {}),
                },
              ]),
        ],
      }),
    }),
  });
}

// A fake model whose request fails before any text, with the given HTTP status.
export function failingModel(statusCode: number) {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new APICallError({
        message: `upstream ${statusCode}`,
        url: 'https://ai-gateway.vercel.sh/v1',
        requestBodyValues: {},
        statusCode,
        isRetryable: false,
      });
    },
  });
}

// Reads an NDJSON chat response into its events.
export async function readEvents(res: Response): Promise<{ type: string; text?: string; message?: string }[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
