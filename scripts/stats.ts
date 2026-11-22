// Usage and questions from the chat log. Usage: DATABASE_URL=... npm run stats [-- --days 14] [-- --questions]
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Tip: `vercel env pull .env.local`, then `set -a; . ./.env.local; set +a`.');
  process.exit(1);
}
const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 14;
const sql = neon(url);

const daily = await sql`
  select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
         count(*)::int as questions,
         count(distinct session_id)::int as sessions,
         count(*) filter (where status <> 'ok')::int as not_ok,
         round(coalesce(sum(cost_usd), 0)::numeric, 4) as cost_usd,
         round(avg(latency_ms))::int as avg_ms
  from chat_messages
  where created_at > now() - make_interval(days => ${days})
  group by 1 order by 1 desc
`;
console.table(daily);

if (args.includes('--questions')) {
  const recent = await sql`
    select to_char(created_at, 'YYYY-MM-DD HH24:MI') as at, status, left(question, 120) as question
    from chat_messages
    where created_at > now() - make_interval(days => ${days})
    order by created_at desc limit 100
  `;
  console.table(recent);
}
