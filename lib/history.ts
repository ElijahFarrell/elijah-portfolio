import type { ModelMessage } from 'ai';
import type { Sql } from './db.js';

// Earlier answers come from the database, not from the browser, so a visitor
// can't edit their saved chat to put words in the assistant's mouth.
export async function loadHistory(sql: Sql, sessionId: string, turns: number): Promise<ModelMessage[]> {
  if (turns <= 0) return [];
  const rows = (await sql`
    select question, answer from chat_messages
    where session_id = ${sessionId} and status = 'ok'
    order by created_at desc, id desc
    limit ${turns}
  `) as { question: string; answer: string }[];
  return rows.reverse().flatMap((row): ModelMessage[] => [
    { role: 'user', content: row.question },
    { role: 'assistant', content: row.answer },
  ]);
}

export type ChatRecord = {
  sessionId: string;
  question: string;
  answer: string;
  status: 'ok' | 'aborted' | 'error';
  model: string;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  cacheReadTokens?: number | undefined;
  cacheWriteTokens?: number | undefined;
  costUsd?: number | undefined;
  latencyMs: number;
};

export async function saveExchange(sql: Sql, r: ChatRecord): Promise<void> {
  await sql`
    insert into chat_messages (
      session_id, question, answer, status, model,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, latency_ms
    ) values (
      ${r.sessionId}, ${r.question}, ${r.answer}, ${r.status}, ${r.model},
      ${r.inputTokens ?? null}, ${r.outputTokens ?? null}, ${r.cacheReadTokens ?? null},
      ${r.cacheWriteTokens ?? null}, ${r.costUsd ?? null}, ${r.latencyMs}
    )
  `;
}
