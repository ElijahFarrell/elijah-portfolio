import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from '../lib/db.js';
import { deleteExpiredMessages } from '../lib/retention.js';

const fakeSql = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => [{ count: 3 }]);

vi.mock('../lib/db.js', () => ({
  getSql: (url: string | undefined) => (url ? fakeSql : undefined),
}));

const { GET } = await import('../api/cron/cleanup.js');

afterEach(() => {
  vi.unstubAllEnvs();
  fakeSql.mockClear();
});

describe('deleteExpiredMessages', () => {
  it('passes the retention window as a query parameter', async () => {
    const deleted = await deleteExpiredMessages(fakeSql as unknown as Sql, 90);
    expect(deleted).toBe(3);
    const [strings, ...values] = fakeSql.mock.calls[0]!;
    expect(strings.join('?')).toContain('delete from chat_messages');
    expect(values).toEqual([90]);
  });
});

describe('GET /api/cron/cleanup', () => {
  const call = (auth?: string) =>
    GET(new Request('https://elijahvfg.com/api/cron/cleanup', { headers: auth ? { authorization: auth } : {} }));

  it('rejects requests without the cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
  });

  it('rejects everything when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer ')).status).toBe(401);
  });

  it('deletes expired rows with the configured retention', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    vi.stubEnv('DATABASE_URL', 'postgres://example');
    vi.stubEnv('RETENTION_DAYS', '90');
    const res = await call('Bearer secret');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 3, retentionDays: 90 });
  });

  it('skips cleanly when the database is not configured', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    vi.stubEnv('DATABASE_URL', '');
    const res = await call('Bearer secret');
    expect(await res.json()).toEqual({ deleted: 0, skipped: 'DATABASE_URL not set' });
    expect(fakeSql).not.toHaveBeenCalled();
  });
});
