import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { LimitStore } from './limits.js';

export function redisFromEnv(env: NodeJS.ProcessEnv = process.env): Redis | undefined {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : undefined;
}

const PREFIX = 'chat';

export class RedisLimitStore implements LimitStore {
  private limiters = new Map<string, Ratelimit>();

  constructor(private readonly redis: Redis) {}

  async hit(key: string, max: number, windowSeconds: number) {
    const id = `${max}/${windowSeconds}`;
    let limiter = this.limiters.get(id);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
        prefix: `${PREFIX}:rl`,
      });
      this.limiters.set(id, limiter);
    }
    const result = await limiter.limit(key);
    return { allowed: result.success, retryAfterSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)) };
  }

  async incrementTurns(sessionId: string, ttlSeconds: number) {
    const key = `${PREFIX}:turns:${sessionId}`;
    const [count] = await this.redis.multi().incr(key).expire(key, ttlSeconds).exec<[number, number]>();
    return count;
  }

  async getSpendMicros(day: string) {
    return Number((await this.redis.get<number>(`${PREFIX}:spend:${day}`)) ?? 0);
  }

  async addSpendMicros(day: string, micros: number) {
    const key = `${PREFIX}:spend:${day}`;
    // Keep two days so the counter outlives the UTC day it belongs to.
    await this.redis.multi().incrby(key, micros).expire(key, 2 * 24 * 60 * 60).exec();
  }

  async isVerified(sessionId: string) {
    return (await this.redis.exists(`${PREFIX}:verified:${sessionId}`)) === 1;
  }

  async markVerified(sessionId: string, ttlSeconds: number) {
    await this.redis.set(`${PREFIX}:verified:${sessionId}`, 1, { ex: ttlSeconds });
  }
}
