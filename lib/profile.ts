import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cached: string | undefined;

// The chat answers from public/llms.txt, the same summary AI search tools read.
// vercel.json bundles that file with the function (includeFiles).
export function readProfile(): string {
  cached ??= readFileSync(join(process.cwd(), 'public', 'llms.txt'), 'utf8').trim();
  return cached;
}
