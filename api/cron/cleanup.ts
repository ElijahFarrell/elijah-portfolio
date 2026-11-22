import { loadConfig } from '../../lib/config.js';
import { getSql } from '../../lib/db.js';
import { deleteExpiredMessages } from '../../lib/retention.js';

// Daily Vercel cron (see vercel.json): deletes chat messages past the retention window.
// Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
export async function GET(request: Request): Promise<Response> {
  const config = loadConfig();
  if (!config.cronSecret || request.headers.get('authorization') !== `Bearer ${config.cronSecret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sql = getSql(config.databaseUrl);
  if (!sql) return Response.json({ deleted: 0, skipped: 'DATABASE_URL not set' });
  const deleted = await deleteExpiredMessages(sql, config.retentionDays);
  return Response.json({ deleted, retentionDays: config.retentionDays });
}
