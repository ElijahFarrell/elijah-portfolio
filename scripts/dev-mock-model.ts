import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

// Canned answers (taken from the site) for working on the panel without an API key.
const ANSWERS: [RegExp, string][] = [
  [
    /fit|role|hire/i,
    "For a backend role, there's solid evidence. At Amazon, Elijah builds Java services, including one API that turns a proposed contract change into a submitted change order, with authorization checks at each approval step and idempotent retries. He also designed a Step Functions workflow that closes out budgets once work ends, recovering about $50M in capital.\n\nNothing on the site shows Kubernetes or Go, so those would be worth asking him about directly: https://www.linkedin.com/in/elijah-farrell",
  ],
  [
    /amazon|work on/i,
    "At Amazon, Elijah works on the platform that manages construction contracts and payments for Amazon's real estate projects, about $4B in spend. Day to day that's Java services, TypeScript/React micro-frontends, and a lot of AI. He has built features touching about $500M, and he reviews code and mentors engineers.",
  ],
  [
    /ai|built|project/i,
    "Elijah has built several AI projects:\n- At Amazon, an LLM pipeline (Bedrock + OpenSearch RAG) that turns vendor documents into the platform's native format, from about 3 hours to under 5 minutes.\n- AI OS, his own multi-agent assistant with memory, RAG over documents, and MCP tools: https://github.com/ElijahFarrell/personal-agent\n- A LlamaIndex RAG service that mixes semantic and keyword search.",
  ],
];

const FALLBACK =
  "This is a local mock answer, so the panel can be tested without an API key. Run `npm run dev:live` with AI_GATEWAY_API_KEY set to use the real model.";

export function devMockModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const last = prompt.at(-1);
      const question = last && last.role === 'user' ? JSON.stringify(last.content) : '';
      const answer = ANSWERS.find(([pattern]) => pattern.test(question))?.[1] ?? FALLBACK;
      const words = answer.split(/(?<=\s)/);
      return {
        stream: simulateReadableStream({
          initialDelayInMs: 600,
          chunkDelayInMs: 25,
          chunks: [
            { type: 'stream-start' as const, warnings: [] },
            { type: 'text-start' as const, id: 't' },
            ...words.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
            { type: 'text-end' as const, id: 't' },
            {
              type: 'finish' as const,
              finishReason: { unified: 'stop' as const, raw: 'end_turn' },
              usage: {
                inputTokens: { total: 2600, noCache: 100, cacheRead: 2500, cacheWrite: 0 },
                outputTokens: { total: words.length, text: words.length, reasoning: 0 },
              },
            },
          ],
        }),
      };
    },
  });
}
