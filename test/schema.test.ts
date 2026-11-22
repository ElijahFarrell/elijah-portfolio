import { describe, expect, it } from 'vitest';
import { deleteExpiredMessages } from '../lib/retention.js';
import { readSchema, splitStatements } from '../lib/schema.js';
import { createTestDb } from './helpers/pg.js';

describe('schema', () => {
  it('splits into statements and skips comments', () => {
    expect(splitStatements('-- note; here\ncreate table a (x int);\n\ncreate index i on a (x);')).toEqual([
      'create table a (x int)',
      'create index i on a (x)',
    ]);
    expect(readSchema().length).toBeGreaterThan(4);
  });

  it('applies cleanly twice (idempotent)', async () => {
    const { db } = await createTestDb();
    for (const statement of readSchema()) await db.exec(statement);
    const tables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual(['chat_messages', 'content_chunks']);
  });

  it('deleteExpiredMessages removes only rows past the window', async () => {
    const { db, sql } = await createTestDb();
    await db.exec(`
      insert into chat_messages (session_id, question, created_at) values
        ('s1', 'old', now() - interval '91 days'),
        ('s1', 'edge', now() - interval '89 days'),
        ('s2', 'new', now());
    `);
    expect(await deleteExpiredMessages(sql, 90)).toBe(1);
    const left = await db.query<{ question: string }>('select question from chat_messages order by id');
    expect(left.rows.map((r) => r.question)).toEqual(['edge', 'new']);
  });
});
