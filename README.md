# elijahvfg.com

Personal site for Elijah Farrell. Static HTML and one shared stylesheet, no build step.

```
public/
  index.html       home: intro, social links, links to the other pages
  experience.html  work history, skills, education (served at /experience)
  projects.html    personal projects with code and live links (served at /projects)
  styles.css       shared styles for every page
  theme.js         dark/light toggle; the choice is saved in localStorage
  resume.pdf       public resume, phone number and email removed
  robots.txt       lets all crawlers in, AI crawlers named explicitly
  sitemap.xml      page list for search engines
  llms.txt         plain-text summary of the site for AI assistants
  og.png           1200x630 link-preview image
  favicon.ico
vercel.json        static deploy config, clean URLs, redirects, daily cleanup cron
api/               Vercel Functions for the "Ask about Elijah" chat (TypeScript)
lib/               shared server code for those functions
db/schema.sql      Postgres schema: chat log and (unused for now) pgvector content chunks
scripts/           dev server, migrations, evals, stats (`npm run dev`, `db:migrate`, `eval`, `stats`)
evals/             test questions for the chat, with the checks each answer must pass
test/              Vitest tests; database tests run on an in-memory Postgres (PGlite)
```

## Edit

Edit the HTML file for the page. When the resume changes, replace `public/resume.pdf` with a copy that has no phone number or email. The current one is the master Typst resume with the phone and email removed from the header line (`typst compile`).

When page content changes, keep these in sync: the page's `<title>`, meta description, and Open Graph/Twitter tags; the JSON-LD block in its `<head>`; `public/llms.txt`; and `lastmod` in `public/sitemap.xml`. Use only facts already on the site, and no email address.

Colors, type sizes, and spacing are CSS variables at the top of `public/styles.css`. Dark is the default; the `[data-theme="light"]` block overrides the colors for light mode. A small inline script in each page's `<head>` applies a saved choice before first paint, and `theme.js` runs the toggle.

## Add a page

1. Copy `public/projects.html` to a new file such as `public/writing.html` and update the title, description, canonical, and `og:` tags. `cleanUrls` in `vercel.json` serves it at `/writing`.
2. Keep the inline theme script in `<head>`, the `<div class="page">` wrapper, and the `.topbar` header (back link and theme toggle). Reuse `.intro` for the top of the page and the column grid for lists: `.columns` holds `section.column` blocks, each with an `h2.label` and a `ul.items` of `li.item` (an `.item-title`, usually a link, then muted `p` lines; `.meta` for small print). It's 3 columns on desktop, `.columns.two` for 2, and one column on phones. Add `rows-2` when each column has up to two items, so items line up row by row across columns. For job-style lists use `.entries` of `article.entry` (title and dates in `.entry-head`, then `.role`); for label/value pairs use `dl.rows`.
3. Link it from the list on `public/index.html`, and add it to `public/sitemap.xml` and `public/llms.txt`.
4. `vercel.json` redirects `/about/*` and `/work/*` (old site routes) to `/`. Remove a route from that list before publishing a page at that path.

## Preview locally

```bash
npx serve public
```

`serve` handles clean URLs (`/experience`) the same way Vercel does. `python3 -m http.server 8000 --directory public` also works, but there you need the `.html` suffix.

## "Ask about Elijah" chat

The pages stay static. The chat panel (`public/chat.js`) talks to Vercel Functions in `api/`, written in TypeScript. It's off until `CHAT_ENABLED=true`; while it's off the panel doesn't appear and the pages look exactly the same.

```bash
npm install
npm run typecheck
npm test
npm run dev        # site + chat at http://localhost:8813 with a mock model (no keys needed)
npm run dev:live   # same, but the real model through AI Gateway (needs AI_GATEWAY_API_KEY)
npm run eval       # the test questions in evals/questions.json against the real model
npm run stats      # questions per day, cost, and latency from the chat log
```

### Turning it on

Do this on **Preview** first, check it, then repeat for **Production**. Every variable is described in `.env.example`.

1. **AI Gateway.** In the Vercel project, open AI Gateway and enable it. Deployments authenticate with the project's OIDC token, so there's no key to paste into production. For local runs (`dev:live`, `eval`), create an API key and put it in `AI_GATEWAY_API_KEY` in `.env.local`.
2. **Gateway budget (backstop).** Set a budget a little above the daily cap. When it's used up the gateway returns 402 and the chat says it's resting.
3. **Postgres.** In the Vercel Marketplace, add **Neon** and connect it to the project. It sets `DATABASE_URL`. Then create the tables once:
   ```bash
   vercel env pull .env.local
   set -a; . ./.env.local; set +a
   npm run db:migrate
   ```
4. **Redis.** In the Vercel Marketplace, add **Upstash for Redis** and connect it. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The chat refuses to run without Redis, because Redis holds the limits.
5. **Turnstile.** In Cloudflare, create a Turnstile widget (managed mode) for `elijahvfg.com`, plus your preview domain if you test there. Set `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_VERIFY_URL` (Turnstile's server-side siteverify URL, from Cloudflare's docs). With the secret set and no verify URL, the chat refuses to run.
6. **Secrets.** Set `CRON_SECRET` and `IP_HASH_SALT` to long random strings, e.g. `openssl rand -hex 32`. Both are required; the chat refuses to run without the salt.
7. **Switch it on.** Set `CHAT_ENABLED=true` and redeploy.
8. **Check it.** Open the preview, ask a few questions, and run `npm run eval`. The panel caches its on/off status for a few minutes per tab.

### How it works

- **Answers:** `POST /api/chat` streams newline-delimited JSON: `{"type":"text"}` pieces, then `{"type":"done"}`, or `{"type":"error"}` if the answer stops early. `GET /api/chat` says whether the panel should show.
- **Model:** Claude Haiku 5.5 through AI Gateway (`CHAT_MODEL` to switch, e.g. `openai/gpt-6-luna`). Caching is on, extended thinking is off, and answers are capped at 400 tokens.
- **What it knows:** only `public/llms.txt`, plus retrieved writing once `RAG_ENABLED=true`. Update `llms.txt` and the chat knows the change on the next deploy. The rules are in `lib/prompt.ts`: third person, no guessing, honest role-fit answers with gaps named, on-topic only, and visitor messages treated as questions, never instructions.
- **History:** earlier turns load from Postgres by session ID, never from the browser.
- **Saved questions:** every question is saved with its answer, status, tokens, cost, and latency. A daily cron (`/api/cron/cleanup`) deletes rows older than `RETENTION_DAYS` (90). No IPs or other identifiers are stored.
- **Limits** (`lib/limits.ts`), checked before every answer, cheapest first:
  - **Daily budget:** stops once the day's spend reaches `DAILY_BUDGET_USD` ($3).
  - **Rate limit:** 10 questions per visitor per 10 minutes, keyed on a salted hash of the IP.
  - **Bot check:** a Turnstile check once per session.
  - **Turn cap:** 20 questions per session.
- **The panel:**
  - **Layout:** it opens on the right. On wide screens the page shifts left and stays usable; on phones the panel covers the page.
  - **Saved chat:** the conversation, session, and open state are kept in `localStorage` for 7 days, so the chat survives refreshes and page changes.
  - **Rendering:** answers are inserted as plain text, with links made clickable. Model output is never inserted as HTML.

### Reading the questions

`npm run stats` shows questions, sessions, failures, cost, and average latency per day. Add `-- --questions` to list recent questions. For anything else, query `chat_messages` in the Neon console.

### Adding Substack and advice later (retrieval)

The `content_chunks` table (pgvector, 1536 dimensions for `openai/text-embedding-3-small`) and the retrieval code are already in place and switched off. When you're ready:

1. Write an ingestion script, e.g. Python with LlamaIndex. It loads posts, splits them into chunks, embeds each chunk with the same model as `EMBEDDING_MODEL` (through AI Gateway or OpenAI directly), and inserts rows: `source` (`substack` or `advice`), `url`, `title`, `chunk_index`, `content`, `embedding`. `(url, chunk_index)` is unique, so re-runs can upsert.
2. Set `RAG_ENABLED=true`. The top `RAG_TOP_K` (4) chunks are added to each question inside a `<writing>` block, and the system prompt already tells the model it may use them.
3. Add a few writing-based questions to `evals/questions.json` and run `npm run eval`.

## Deploy

Vercel deploys on push. `vercel.json` sets the framework preset to "Other", skips install and build, serves `public/` as-is, and turns on clean URLs, so the Vercel project settings don't need changes.

## Analytics

Vercel Web Analytics is on (`/_vercel/insights/script.js`). Don't let your own test or screenshot visits to https://elijahvfg.com count: set `localStorage.setItem("va-disable", "true")` on that origin before page scripts run (in Playwright, `context.addInitScript(() => localStorage.setItem("va-disable", "true"))`), or check a local copy (`npx serve public`) instead. In a normal browser, run that line once in the devtools console on elijahvfg.com. `curl` checks don't run the script, so they aren't counted.
