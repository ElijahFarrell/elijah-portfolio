// Applies db/schema.sql to the database in DATABASE_URL. Safe to re-run.
// Usage: DATABASE_URL=... npm run db:migrate
import { neon } from '@neondatabase/serverless';
import { readSchema } from '../lib/schema.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(url);
const statements = readSchema();
for (const statement of statements) {
  await sql.query(statement);
  console.log('ok:', statement.split('\n')[0]);
}
console.log(`Applied ${statements.length} statements.`);
