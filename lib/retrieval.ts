import type { Sql } from './db.js';

export type EmbedFn = (text: string) => Promise<number[]>;

export async function retrieveWriting(
  question: string,
  deps: { sql: Sql; embed: EmbedFn; topK: number },
): Promise<string | undefined> {
  const embedding = await deps.embed(question);
  const rows = (await deps.sql`
    select title, url, content from content_chunks
    order by embedding <=> ${`[${embedding.join(',')}]`}::vector
    limit ${deps.topK}
  `) as { title: string | null; url: string | null; content: string }[];
  if (rows.length === 0) return undefined;
  return rows
    .map((r) => [r.title && `Title: ${r.title}`, r.url && `URL: ${r.url}`, r.content].filter(Boolean).join('\n'))
    .join('\n\n---\n\n');
}
