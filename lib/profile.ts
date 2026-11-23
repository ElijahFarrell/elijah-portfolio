import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cached: string | undefined;

// The chat answers from public/llms.txt (the same summary AI search tools read)
// plus content/notes.md (extra facts Elijah has added for the chat).
// vercel.json bundles both files with the function (includeFiles).
export function readProfile(): string {
  cached ??= [readFileSync(join(process.cwd(), 'public', 'llms.txt'), 'utf8').trim(), readNotes()]
    .filter(Boolean)
    .join('\n\n');
  return cached;
}

// The notes add detail but aren't essential, so a missing file only logs a warning.
function readNotes(): string {
  try {
    return readFileSync(join(process.cwd(), 'content', 'notes.md'), 'utf8').trim();
  } catch (err) {
    console.warn('chat: content/notes.md not found; answering from llms.txt only', err);
    return '';
  }
}
