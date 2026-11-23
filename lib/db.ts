import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type Sql = NeonQueryFunction<false, false>;

let cached: { url: string; sql: Sql } | undefined;

// Returns a Postgres client over HTTP, or undefined when DATABASE_URL isn't set.
export function getSql(databaseUrl: string | undefined): Sql | undefined {
  if (!databaseUrl) return undefined;
  if (cached?.url !== databaseUrl) cached = { url: databaseUrl, sql: neon(databaseUrl) };
  return cached.sql;
}
