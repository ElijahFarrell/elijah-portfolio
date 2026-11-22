import type { Sql } from './db.js';

// Deletes chat messages older than `days`. Returns how many rows were removed.
export async function deleteExpiredMessages(sql: Sql, days: number): Promise<number> {
  const rows = await sql`
    with deleted as (
      delete from chat_messages
      where created_at < now() - make_interval(days => ${days})
      returning 1
    )
    select count(*)::int as count from deleted
  `;
  return Number(rows[0]?.count ?? 0);
}
