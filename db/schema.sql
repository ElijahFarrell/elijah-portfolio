-- Schema for the "Ask about Elijah" chat. Safe to re-run: every statement is idempotent.
-- Apply with `npm run db:migrate` (needs DATABASE_URL).

-- One row per question asked in the chat panel. Kept for RETENTION_DAYS (90 by
-- default), then deleted by the daily cleanup cron. No IP addresses or other
-- visitor identifiers are stored; session_id is a random ID made in the browser.
create table if not exists chat_messages (
  id bigserial primary key,
  session_id text not null,
  created_at timestamptz not null default now(),
  question text not null,
  answer text not null default '',
  -- ok | aborted | error
  status text not null default 'ok',
  model text,
  -- cost_usd is what the daily cap and `npm run stats` use. The token counts
  -- explain it: input vs output shows where the money goes, and
  -- cache_read_tokens shows whether prompt caching is working (the system
  -- prompt is most of each request, so a run of zeros means paying full price).
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cost_usd numeric(12, 8),
  latency_ms integer
);

create index if not exists chat_messages_session_idx on chat_messages (session_id, created_at);
create index if not exists chat_messages_created_idx on chat_messages (created_at);

-- Retrieval over longer writing (Substack posts, advice). Not used yet: the chat
-- answers from public/llms.txt until RAG_ENABLED=true and this table has rows.
-- An offline ingestion script (LlamaIndex, Python) will chunk and embed content
-- and insert rows here. The vector size matches openai/text-embedding-3-small.
create extension if not exists vector;

create table if not exists content_chunks (
  id bigserial primary key,
  -- e.g. 'substack', 'advice'
  source text not null,
  url text,
  title text,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (url, chunk_index)
);

create index if not exists content_chunks_embedding_idx
  on content_chunks using hnsw (embedding vector_cosine_ops);
