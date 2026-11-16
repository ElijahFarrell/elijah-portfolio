# elijahvfg.com

Personal site for Elijah Farrell. Static HTML and one shared stylesheet, no build step.

```
public/
  index.html       home: intro, social links, links to the other pages
  experience.html  work history, skills, education (served at /experience)
  projects.html    personal projects with code and live links (served at /projects)
  styles.css       shared styles for every page
  theme.js         dark/light toggle; the choice is saved in localStorage
  resume.pdf       public resume, phone number removed
  og.png           1200x630 link-preview image
  favicon.ico
vercel.json        static deploy config, clean URLs, redirects from the old site's routes
```

## Edit

Edit the HTML file for the page. When the resume changes, replace `public/resume.pdf` with a copy that has no phone number.

Colors, type sizes, and spacing are CSS variables at the top of `public/styles.css`. Dark is the default; the `[data-theme="light"]` block overrides the colors for light mode. A small inline script in each page's `<head>` applies a saved choice before first paint, and `theme.js` runs the toggle.

## Add a page

1. Copy `public/projects.html` to a new file such as `public/writing.html` and update the title, description, canonical, and `og:` tags. `cleanUrls` in `vercel.json` serves it at `/writing`.
2. Keep the inline theme script in `<head>`, the `<div class="page">` wrapper, and the `.topbar` header (back link and theme toggle). Reuse `.intro` for the top of the page and the column grid for lists: `.columns` holds `section.column` blocks, each with an `h2.label` and a `ul.items` of `li.item` (an `.item-title`, usually a link, then muted `p` lines; `.meta` for small print). It's 3 columns on desktop, `.columns.two` for 2, and one column on phones.
3. Link it from the list on `public/index.html`.
4. `vercel.json` redirects `/about/*` and `/work/*` (old site routes) to `/`. Remove a route from that list before publishing a page at that path.

## Preview locally

```bash
npx serve public
```

`serve` handles clean URLs (`/experience`) the same way Vercel does. `python3 -m http.server 8000 --directory public` also works, but there you need the `.html` suffix.

## Deploy

Vercel deploys on push. `vercel.json` sets the framework preset to "Other", skips install and build, serves `public/` as-is, and turns on clean URLs, so the Vercel project settings don't need changes.
