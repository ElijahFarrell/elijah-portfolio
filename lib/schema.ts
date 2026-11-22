import { readFileSync } from 'node:fs';

// The Neon HTTP driver runs one statement per query, so the schema is split on
// statement ends. db/schema.sql has no functions or quoted semicolons.
export function splitStatements(sqlText: string): string[] {
  return sqlText
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function readSchema(): string[] {
  return splitStatements(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
}
