// Local preview of the site and the chat panel: `npm run dev` (mock model) or
// `npm run dev:live` (real model through AI Gateway; needs AI_GATEWAY_API_KEY).
// Serves public/ with clean URLs, like Vercel, and runs the real /api/chat handler
// with in-memory limits (loose unless --strict). DATABASE_URL is used if set;
// otherwise nothing is saved.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import { gateway } from 'ai';
import { chatStatus, handleChat } from '../lib/chat.js';
import { loadConfig } from '../lib/config.js';
import { getSql } from '../lib/db.js';
import { ChatLimits, MemoryLimitStore } from '../lib/limits.js';
import { devMockModel } from './dev-mock-model.js';

const live = process.argv.includes('--live');
const port = Number(process.env.PORT ?? 8813);
const publicDir = join(process.cwd(), 'public');
const config = loadConfig({ ...process.env, CHAT_ENABLED: 'true' });
// Loose limits locally so repeated testing doesn't trip them; pass --strict to use the real ones.
const strict = process.argv.includes('--strict');
// Local runs keep counters in memory only, so a fixed salt is fine here.
const localConfig = { ...config, ipHashSalt: config.ipHashSalt ?? 'local-dev' };
const limits = new ChatLimits(
  new MemoryLimitStore(),
  strict ? localConfig : { ...localConfig, rateLimitMax: 1000, sessionMaxTurns: 1000 },
  undefined,
);
const sql = getSql(config.databaseUrl);
const mock = devMockModel();

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

function staticPath(pathname: string): string | undefined {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = clean.endsWith('/') ? [join(clean, 'index.html')] : [clean, `${clean}.html`];
  for (const candidate of candidates) {
    const file = join(publicDir, candidate);
    if (file.startsWith(publicDir) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${port}`}`);

  // BotID's challenge only exists on Vercel; locally the script would make every
  // /api/chat fetch fail. The handler here doesn't check for bots anyway.
  if (url.pathname === '/botid.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    res.end('// Vercel BotID runs on deployments only.\n');
    return;
  }

  if (url.pathname === '/api/chat') {
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    const request = new Request(url, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? (Readable.toWeb(req) as ReadableStream) : undefined,
      signal: abort.signal,
      duplex: 'half',
    } as RequestInit);

    const response =
      req.method === 'POST'
        ? await handleChat(request, {
            config,
            sql,
            limits,
            getModel: (id) => (live ? gateway(id) : mock),
            waitUntil: (promise) => void promise.catch(() => {}),
          })
        : await chatStatus(config, limits);

    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const chunk of response.body) res.write(chunk);
    res.end();
    return;
  }

  const file = staticPath(url.pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Site and chat (${live ? `live: ${config.chatModel}` : 'mock model'}) at http://localhost:${port}`);
});
