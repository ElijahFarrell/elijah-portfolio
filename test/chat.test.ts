import { describe, expect, it } from 'vitest';
import type { LanguageModel } from 'ai';
import { handleChat, chatStatus, type ChatDeps } from '../lib/chat.js';
import { loadConfig } from '../lib/config.js';
import { loadHistory, saveExchange } from '../lib/history.js';
import { ChatLimits, MemoryLimitStore } from '../lib/limits.js';
import { createTestDb } from './helpers/pg.js';
import { failingModel, mockModel, readEvents } from './helpers/model.js';

const SESSION = 'session_abcdefghijklmnop';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://elijahvfg.com/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'elijahvfg.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const shared = createTestDb();

async function setup(model: LanguageModel, env: Record<string, string> = {}) {
  const { db, sql } = await shared;
  await db.exec('truncate chat_messages restart identity');
  const pending: Promise<unknown>[] = [];
  const config = loadConfig({ CHAT_ENABLED: 'true', ...env });
  const deps: ChatDeps = {
    config,
    sql,
    getModel: () => model,
    limits: new ChatLimits(new MemoryLimitStore(), config, undefined),
    waitUntil: (p) => void pending.push(p),
    profile: 'Elijah Farrell is a software engineer at Amazon.',
  };
  // Saves happen after the response finishes; wait until they've been scheduled and done.
  const settle = async () => {
    for (let i = 0; i < 100 && pending.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    await Promise.all(pending);
  };
  const rows = async () =>
    (await db.query<Record<string, unknown>>('select * from chat_messages order by id')).rows;
  return { db, sql, deps, settle, rows };
}

describe('handleChat', () => {
  it('streams the answer as NDJSON and saves it with usage and cost', async () => {
    const { deps, settle, rows } = await setup(mockModel(['Elijah has ', 'built AI agents.'], { cost: '0.00004' }));
    const res = await handleChat(makeRequest({ sessionId: SESSION, message: '  What has he built?  ' }), deps);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(await readEvents(res)).toEqual([
      { type: 'text', text: 'Elijah has ' },
      { type: 'text', text: 'built AI agents.' },
      { type: 'done' },
    ]);

    await settle();
    const [row] = await rows();
    expect(row).toMatchObject({
      session_id: SESSION,
      question: 'What has he built?',
      answer: 'Elijah has built AI agents.',
      status: 'ok',
      model: 'anthropic/claude-haiku-5.5',
      input_tokens: 1200,
      output_tokens: 40,
      cache_read_tokens: 1000,
    });
    expect(Number(row!.cost_usd)).toBeCloseTo(0.00004, 8);
  });

  it('sends the system prompt, earlier turns from the database, and model options', async () => {
    const model = mockModel(['Yes.']);
    const { deps, sql, settle } = await setup(model);
    await saveExchange(sql, {
      sessionId: SESSION, question: 'Where does he work?', answer: 'At Amazon.', status: 'ok', model: 'm', latencyMs: 1,
    });
    await saveExchange(sql, {
      sessionId: SESSION, question: 'ignored', answer: 'cut off', status: 'error', model: 'm', latencyMs: 1,
    });

    await readEvents(await handleChat(makeRequest({ sessionId: SESSION, message: 'Since when?' }), deps));
    await settle();

    const call = model.doStreamCalls[0]!;
    const prompt = JSON.stringify(call.prompt);
    expect(call.prompt[0]).toMatchObject({ role: 'system' });
    expect(prompt).toContain('Elijah Farrell is a software engineer at Amazon.');
    expect(prompt).toContain('Where does he work?');
    expect(prompt).toContain('At Amazon.');
    expect(prompt).not.toContain('cut off');
    expect(call.prompt.at(-1)).toMatchObject({ role: 'user' });
    expect(call.maxOutputTokens).toBe(400);
    expect(call.providerOptions).toMatchObject({
      gateway: { caching: 'auto' },
      anthropic: { thinking: { type: 'disabled' }, effort: 'low' },
    });
  });

  it('refuses when the chat is switched off', async () => {
    const { deps } = await setup(mockModel(['x']), { CHAT_ENABLED: 'false' });
    const res = await handleChat(makeRequest({ sessionId: SESSION, message: 'hi' }), deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'disabled' });
  });

  it.each([
    [{ sessionId: 'short', message: 'hi' }, 400, 'bad_request'],
    [{ sessionId: SESSION, message: '   ' }, 400, 'empty'],
    [{ sessionId: SESSION, message: 'x'.repeat(4001) }, 413, 'too_long'],
    ['not json', 400, 'bad_request'],
  ])('rejects invalid input %#', async (body, status, error) => {
    const { deps } = await setup(mockModel(['x']));
    const res = await handleChat(makeRequest(body), deps);
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error });
  });

  it('rejects cross-site requests', async () => {
    const { deps } = await setup(mockModel(['x']));
    const res = await handleChat(
      makeRequest({ sessionId: SESSION, message: 'hi' }, { origin: 'https://evil.example' }),
      deps,
    );
    expect(res.status).toBe(403);
  });

  it.each([
    [402, 503, 'resting'],
    [429, 503, 'busy'],
    [500, 502, 'upstream'],
  ])('turns an upstream %i before any text into a clear error', async (upstream, status, error) => {
    const { deps, settle, rows } = await setup(failingModel(upstream));
    const res = await handleChat(makeRequest({ sessionId: SESSION, message: 'hi' }), deps);
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ error });
    await settle();
    expect((await rows())[0]).toMatchObject({ status: 'error', answer: '' });
  });

  it('tells the browser when an answer is cut off mid-stream', async () => {
    const { deps, settle, rows } = await setup(mockModel(['Partial '], { failMidStream: true }));
    const events = await readEvents(await handleChat(makeRequest({ sessionId: SESSION, message: 'hi' }), deps));
    expect(events).toEqual([
      { type: 'text', text: 'Partial ' },
      { type: 'error', message: 'The answer was cut off. Please try again.' },
    ]);
    await settle();
    expect((await rows())[0]).toMatchObject({ status: 'error', answer: 'Partial ' });
  });

  it('records an aborted answer when the visitor closes the stream', async () => {
    const { deps, settle, rows } = await setup(mockModel(['One ', 'two ', 'three ', 'four']));
    const res = await handleChat(makeRequest({ sessionId: SESSION, message: 'hi' }), deps);
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await settle();
    const [row] = await rows();
    expect(row!.status).toBe('aborted');
  });

  it('works without a database (no history, nothing saved)', async () => {
    const { deps } = await setup(mockModel(['Hi.']));
    const res = await handleChat(makeRequest({ sessionId: SESSION, message: 'hi' }), { ...deps, sql: undefined });
    expect(await readEvents(res)).toEqual([{ type: 'text', text: 'Hi.' }, { type: 'done' }]);
  });
});

describe('chatStatus', () => {
  it('reports whether the chat is on, cacheable for a minute', async () => {
    const config = loadConfig({ CHAT_ENABLED: 'true' });
    const limits = new ChatLimits(new MemoryLimitStore(), config, undefined);
    const res = await chatStatus(config, limits);
    expect(await res.json()).toEqual({ enabled: true, resting: false });
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
    expect(await (await chatStatus(loadConfig({}), limits)).json()).toEqual({ enabled: false, resting: false });
    // No limits store means no chat, even when switched on.
    expect(await (await chatStatus(config, undefined)).json()).toEqual({ enabled: false, resting: false });
  });
});

describe('loadHistory', () => {
  it('returns the most recent successful turns, oldest first', async () => {
    const { db, sql } = await shared;
    await db.exec('truncate chat_messages restart identity');
    for (const q of ['one', 'two', 'three']) {
      await saveExchange(sql, { sessionId: SESSION, question: q, answer: `a-${q}`, status: 'ok', model: 'm', latencyMs: 1 });
    }
    await saveExchange(sql, { sessionId: 'other_session_123456', question: 'x', answer: 'y', status: 'ok', model: 'm', latencyMs: 1 });
    expect(await loadHistory(sql, SESSION, 2)).toEqual([
      { role: 'user', content: 'two' },
      { role: 'assistant', content: 'a-two' },
      { role: 'user', content: 'three' },
      { role: 'assistant', content: 'a-three' },
    ]);
    expect(await loadHistory(sql, SESSION, 0)).toEqual([]);
  });
});
