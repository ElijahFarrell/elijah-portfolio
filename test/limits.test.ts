import { describe, expect, it } from 'vitest';
import { chatStatus, handleChat, type ChatDeps } from '../lib/chat.js';
import { loadConfig } from '../lib/config.js';
import { ChatLimits, MemoryLimitStore, clientKey, utcDay } from '../lib/limits.js';
import { redisFromEnv } from '../lib/limits-redis.js';
import { mockModel, readEvents } from './helpers/model.js';

const SESSION = 'session_abcdefghijklmnop';
const NOW = Date.parse('2026-11-22T15:00:00Z');

function ask(message = 'What has he built?', extra: Record<string, unknown> = {}, ip = '203.0.113.7') {
  return new Request('https://elijahvfg.com/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'elijahvfg.com', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify({ sessionId: SESSION, message, ...extra }),
  });
}

function setup(env: Record<string, string> = {}, isBot?: () => Promise<boolean>) {
  const config = loadConfig({ CHAT_ENABLED: 'true', ...env });
  const store = new MemoryLimitStore(() => NOW);
  const limits = new ChatLimits(store, { ...config, ipHashSalt: 'test-salt' }, isBot, () => NOW);
  const pending: Promise<unknown>[] = [];
  const deps: ChatDeps = {
    config,
    sql: undefined,
    getModel: () => mockModel(['Elijah has built AI agents.'], { cost: '0.5' }),
    limits,
    waitUntil: (p) => void pending.push(p),
    profile: 'profile',
  };
  const settle = async () => {
    for (let i = 0; i < 100 && pending.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    await Promise.all(pending);
    pending.length = 0;
  };
  return { config, store, limits, deps, settle };
}

describe('limits', () => {
  it('refuses to run without a limits store', async () => {
    const { deps } = setup();
    const res = await handleChat(ask(), { ...deps, limits: undefined });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'disabled' });
  });

  it('rate-limits each visitor and says when to retry', async () => {
    const { deps } = setup({ RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_SECONDS: '600' });
    expect((await handleChat(ask(), deps)).status).toBe(200);
    expect((await handleChat(ask(), deps)).status).toBe(200);
    const blocked = await handleChat(ask(), deps);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: 'rate_limited' });
    expect(Number(blocked.headers.get('retry-after'))).toBe(600);
    // A different visitor isn't affected.
    expect((await handleChat(ask('hi', {}, '198.51.100.4'), deps)).status).toBe(200);
  });

  it('caps the number of turns in one session', async () => {
    const { deps } = setup({ SESSION_MAX_TURNS: '2', RATE_LIMIT_MAX: '100' });
    await handleChat(ask(), deps);
    await handleChat(ask(), deps);
    const res = await handleChat(ask(), deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'session_limit' });
  });

  it('records spend after each answer and rests once the daily budget is used', async () => {
    const { deps, store, settle } = setup({ DAILY_BUDGET_USD: '1', RATE_LIMIT_MAX: '100' });
    // The mock model reports $0.50 per answer through gateway metadata.
    await readEvents(await handleChat(ask(), deps));
    await settle();
    expect(await store.getSpendMicros(utcDay(NOW))).toBe(500_000);
    await readEvents(await handleChat(ask(), deps));
    await settle();
    expect(await store.getSpendMicros(utcDay(NOW))).toBe(1_000_000);

    const res = await handleChat(ask(), deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'resting' });
    expect(await (await chatStatus(deps.config, deps.limits)).json()).toMatchObject({ enabled: true, resting: true });
  });

  it('counts an aborted answer against the budget with a rough estimate', async () => {
    const { deps, store, settle } = setup();
    deps.getModel = () => mockModel(['One ', 'two ', 'three']);
    const res = await handleChat(ask(), deps);
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await settle();
    expect(await store.getSpendMicros(utcDay(NOW))).toBeGreaterThan(0);
  });

  it('turns away requests BotID flags', async () => {
    let bot = true;
    const { deps } = setup({ RATE_LIMIT_MAX: '100' }, async () => bot);
    const blocked = await handleChat(ask(), deps);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ error: 'bot' });
    bot = false;
    expect((await handleChat(ask(), deps)).status).toBe(200);
  });

  it('hashes visitor IPs instead of storing them', () => {
    const key = clientKey(ask(), 'salt');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('203.0.113.7');
    expect(clientKey(ask(), 'other-salt')).not.toBe(key);
  });
});

describe('redisFromEnv', () => {
  it('accepts either the Upstash or the Vercel KV variable names', () => {
    expect(redisFromEnv({})).toBeUndefined();
    expect(redisFromEnv({ KV_REST_API_URL: 'https://example.upstash.io', KV_REST_API_TOKEN: 't' })).toBeDefined();
    expect(redisFromEnv({ UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' })).toBeDefined();
  });
});
