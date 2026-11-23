import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import type { Sql } from '../../lib/db.js';
import { readSchema } from '../../lib/schema.js';

// An in-memory Postgres (with pgvector) that has the real schema applied, plus a
// tagged-template `sql` function shaped like the Neon client the app uses.
export async function createTestDb(): Promise<{ db: PGlite; sql: Sql }> {
  const db = await PGlite.create({ extensions: { vector } });
  for (const statement of readSchema()) await db.exec(statement);

  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? '';
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1] ?? ''}`));
    return (await db.query(text, values)).rows;
  };
  return { db, sql: sql as unknown as Sql };
}
