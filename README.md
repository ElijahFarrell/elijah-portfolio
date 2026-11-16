# elijahvfg.com

Personal site for Elijah Farrell. Static HTML and one shared stylesheet, no build step.

```
public/
  index.html       home: intro, social links, links to the other pages
  experience.html  work history, skills, education (served at /experience)
  projects.html    personal projects with code and live links (served at /projects)
  styles.css       shared styles for every page (light/dark follows the OS setting)
  resume.pdf       public resume, phone number removed
  og.png           1200x630 link-preview image
  favicon.ico
vercel.json        static deploy config, clean URLs, redirects from the old site's routes
```

## Edit

Edit the HTML file for the page. When the resume changes, replace `public/resume.pdf` with a copy that has no phone number.

Colors, type sizes, and spacing are CSS variables at the top of `public/styles.css`; the dark palette overrides them in the `prefers-color-scheme: dark` block.

## Add a page

1. Copy `public/projects.html` to a new file such as `public/writing.html` and update the title, description, canonical, and `og:` tags. `cleanUrls` in `vercel.json` serves it at `/writing`.
2. Keep the `<div class="page">` wrapper and the `.crumb` back link, then reuse `.intro`, `section > h2`, `.entry`, `.entry-head`, `.entry-meta`, `.role`, and `.rows` for content.
3. Link it from the list on `public/index.html`.
4. `vercel.json` redirects `/about/*` and `/work/*` (old site routes) to `/`. Remove a route from that list before publishing a page at that path.

## Preview locally

```bash
npx serve public
```

`serve` handles clean URLs (`/experience`) the same way Vercel does. `python3 -m http.server 8000 --directory public` also works, but there you need the `.html` suffix.

## Deploy

Vercel deploys on push. `vercel.json` sets the framework preset to "Other", skips install and build, serves `public/` as-is, and turns on clean URLs, so the Vercel project settings don't need changes.
