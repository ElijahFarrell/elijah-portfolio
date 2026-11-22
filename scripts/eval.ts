// Runs the chat's test questions and checks the answers.
//
//   npm run eval                      in-process, real model via AI Gateway (needs AI_GATEWAY_API_KEY)
//   npm run eval -- --url <base-url>  against a deployment's /api/chat (Turnstile must be off there)
//        [--bypass <token>]           Vercel "Protection Bypass for Automation" token for previews
//   npm run eval -- --only fit-gap    run one case
//
// Each question gets a fresh session. Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { gateway } from 'ai';
import { handleChat } from '../lib/chat.js';
import { loadConfig } from '../lib/config.js';
import { ChatLimits, MemoryLimitStore } from '../lib/limits.js';
import { grade, type EvalCase } from './eval-grade.js';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const baseUrl = flag('--url')?.replace(/\/$/, '');
const bypass = flag('--bypass');
const only = flag('--only');

const cases = (JSON.parse(readFileSync(new URL('../evals/questions.json', import.meta.url), 'utf8')) as EvalCase[]).filter(
  (c) => !only || c.id === only,
);

const config = loadConfig({ ...process.env, CHAT_ENABLED: 'true' });
const limits = new ChatLimits(
  new MemoryLimitStore(),
  { ...config, rateLimitMax: 1000, sessionMaxTurns: 1000, turnstileSecretKey: undefined },
  undefined,
);

async function ask(question: string): Promise<{ answer: string; status: number; ms: number }> {
  const started = Date.now();
  const body = JSON.stringify({ sessionId: randomUUID(), message: question });
  const res = baseUrl
    ? await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
        },
        body,
      })
    : await handleChat(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json', host: 'localhost' },
          body,
        }),
        { config, sql: undefined, limits, getModel: (id) => gateway(id), waitUntil: () => {} },
      );
  if (!res.ok) return { answer: JSON.stringify(await res.json().catch(() => ({}))), status: res.status, ms: Date.now() - started };
  let answer = '';
  for (const line of (await res.text()).split('\n')) {
    if (!line) continue;
    const event = JSON.parse(line) as { type: string; text?: string; message?: string };
    if (event.type === 'text') answer += event.text;
    if (event.type === 'error') answer += `\n[error] ${event.message}`;
  }
  return { answer, status: res.status, ms: Date.now() - started };
}

console.log(`Running ${cases.length} questions against ${baseUrl ?? `${config.chatModel} (in-process)`}\n`);
let failed = 0;
for (const c of cases) {
  const { answer, status, ms } = await ask(c.question);
  const problems = status === 200 ? grade(c, answer) : [`HTTP ${status}: ${answer}`];
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'pass'}  ${c.id}  (${ms} ms)`);
  console.log(`      Q: ${c.question}`);
  console.log(`      A: ${answer.replace(/\n/g, '\n         ')}`);
  for (const p of problems) console.log(`      ! ${p}`);
  console.log();
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
