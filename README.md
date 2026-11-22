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
scripts/           one-off tools, e.g. `npm run db:migrate`
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

## Chat backend

The pages stay static. The chat panel talks to Vercel Functions in `api/`, written in TypeScript.

```bash
npm install
npm run typecheck
npm test
```

Database setup: add Neon Postgres from the Vercel Marketplace (it sets `DATABASE_URL`), then run `npm run db:migrate` once with that URL. A daily cron (`/api/cron/cleanup`, set in `vercel.json`) deletes chat questions older than `RETENTION_DAYS` (90). Set `CRON_SECRET` so only Vercel can call it. All variables are listed in `.env.example`.

## Deploy

Vercel deploys on push. `vercel.json` sets the framework preset to "Other", skips install and build, serves `public/` as-is, and turns on clean URLs, so the Vercel project settings don't need changes.

## Analytics

Vercel Web Analytics is on (`/_vercel/insights/script.js`). Don't let your own test or screenshot visits to https://elijahvfg.com count: set `localStorage.setItem("va-disable", "true")` on that origin before page scripts run (in Playwright, `context.addInitScript(() => localStorage.setItem("va-disable", "true"))`), or check a local copy (`npx serve public`) instead. In a normal browser, run that line once in the devtools console on elijahvfg.com. `curl` checks don't run the script, so they aren't counted.
