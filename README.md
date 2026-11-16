# elijahvfg.com

Personal site for Elijah Farrell. Static HTML and one shared stylesheet, no build step.

```
public/
  index.html   page content
  styles.css   shared styles for every page (light/dark follows the OS setting)
  resume.pdf   public resume, phone number removed
  og.png       1200x630 link-preview image
  favicon.ico
vercel.json    static deploy config and redirects from the old site's routes
```

## Edit

Change `public/index.html`. When the resume changes, replace `public/resume.pdf` with a copy that has no phone number.

Colors, type sizes, and spacing are CSS variables at the top of `public/styles.css`; the dark palette overrides them in the `prefers-color-scheme: dark` block.

## Add a page

1. Copy the `<head>` of `public/index.html` into a new file such as `public/work.html` and update the title, description, canonical, and `og:` tags.
2. Wrap the body in `<div class="page">` and start it with `<a class="crumb" href="/">Elijah Farrell</a>`.
3. Reuse `section > h2`, `.entry`, `.entry-head`, `.entry-meta`, `.role`, and `.rows` for content.
4. `vercel.json` redirects `/about/*` and `/work/*` (old site routes) to `/`. Remove a route from that list before publishing a page at that path.

## Preview locally

```bash
python3 -m http.server 8000 --directory public
```

Then open http://localhost:8000.

## Deploy

Vercel deploys on push. `vercel.json` sets the framework preset to "Other", skips install and build, and serves `public/` as-is, so the Vercel project settings don't need changes.
