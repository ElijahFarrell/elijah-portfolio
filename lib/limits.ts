import { createHash } from 'node:crypto';
import type { Config } from './config.js';
import { ERRORS, errorResponse } from './errors.js';

// Storage behind the limits. Redis in production (lib/limits-redis.ts); an
// in-memory version (below) for tests and local development.
export interface LimitStore {
  // Counts a request for `key` in a sliding window; says whether it's allowed.
  hit(key: string, max: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  // Adds one turn to a session and returns the new count. Expires after `ttlSeconds`.
  incrementTurns(sessionId: string, ttlSeconds: number): Promise<number>;
  getSpendMicros(day: string): Promise<number>;
  addSpendMicros(day: string, micros: number): Promise<void>;
  isVerified(sessionId: string): Promise<boolean>;
  markVerified(sessionId: string, ttlSeconds: number): Promise<void>;
}

export type TurnstileVerifier = (token: string, ip: string) => Promise<boolean>;

// The settings ChatLimits reads, with the salt known to be set.
export type LimitsConfig = Config & { ipHashSalt: string };

// Says which required setting is missing, if any. Without them the chat refuses to run.
export function missingLimitSetting(config: Config): string | undefined {
  if (!config.ipHashSalt) return 'IP_HASH_SALT';
  if (config.turnstileSecretKey && !config.turnstileVerifyUrl) return 'TURNSTILE_VERIFY_URL';
  return undefined;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// First address in X-Forwarded-For (set by Vercel), hashed so raw IPs are never stored.
export function clientKey(request: Request, salt: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
}

export class ChatLimits {
  constructor(
    private readonly store: LimitStore,
    private readonly config: LimitsConfig,
    private readonly verifyTurnstile: TurnstileVerifier | undefined,
    private readonly now: () => number = Date.now,
  ) {}

  // Runs every check, cheapest first. Returns an error response, or undefined to go ahead.
  async check(input: {
    request: Request;
    sessionId: string;
    turnstileToken: string | undefined;
  }): Promise<Response | undefined> {
    const { config, store } = this;

    if (await this.isResting()) return errorResponse(ERRORS.Resting);

    const visitor = clientKey(input.request, config.ipHashSalt);
    const rate = await store.hit(`ip:${visitor}`, config.rateLimitMax, config.rateLimitWindowSeconds);
    if (!rate.allowed) {
      const res = errorResponse(ERRORS.RateLimited);
      res.headers.set('retry-after', String(rate.retryAfterSeconds));
      return res;
    }

    if (this.verifyTurnstile && !(await store.isVerified(input.sessionId))) {
      const ok = input.turnstileToken ? await this.verifyTurnstile(input.turnstileToken, clientIp(input.request)) : false;
      if (!ok) return errorResponse(ERRORS.Verify);
      await store.markVerified(input.sessionId, SESSION_TTL_SECONDS);
    }

    const turns = await store.incrementTurns(input.sessionId, SESSION_TTL_SECONDS);
    if (turns > config.sessionMaxTurns) {
      return errorResponse(ERRORS.SessionLimit);
    }
    return undefined;
  }

  async isResting(): Promise<boolean> {
    const spent = await this.store.getSpendMicros(utcDay(this.now()));
    return spent >= this.config.dailyBudgetUsd * 1_000_000;
  }

  async recordSpend(usd: number): Promise<void> {
    if (!(usd > 0)) return;
    await this.store.addSpendMicros(utcDay(this.now()), Math.ceil(usd * 1_000_000));
  }
}

// In-memory store for tests and local development. Not shared across instances.
export class MemoryLimitStore implements LimitStore {
  private hits = new Map<string, number[]>();
  private turns = new Map<string, number>();
  private spend = new Map<string, number>();
  private verified = new Set<string>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(key: string, max: number, windowSeconds: number) {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - windowSeconds * 1000);
    const allowed = recent.length < max;
    if (allowed) recent.push(now);
    this.hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return { allowed, retryAfterSeconds: allowed ? 0 : Math.ceil((oldest + windowSeconds * 1000 - now) / 1000) };
  }

  async incrementTurns(sessionId: string) {
    const next = (this.turns.get(sessionId) ?? 0) + 1;
    this.turns.set(sessionId, next);
    return next;
  }

  async getSpendMicros(day: string) {
    return this.spend.get(day) ?? 0;
  }

  async addSpendMicros(day: string, micros: number) {
    this.spend.set(day, (this.spend.get(day) ?? 0) + micros);
  }

  async isVerified(sessionId: string) {
    return this.verified.has(sessionId);
  }

  async markVerified(sessionId: string) {
    this.verified.add(sessionId);
  }
}
