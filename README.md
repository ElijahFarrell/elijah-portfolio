# elijahvfg.com

Personal site for Elijah Farrell. One static HTML page, no build step.

```
public/
  index.html   page content
  styles.css   styles (light/dark follows the OS setting)
  resume.pdf   public resume, phone number removed
  og.png       1200x630 link-preview image
  favicon.ico
vercel.json    static deploy config and redirects from the old site's routes
```

## Edit

Change `public/index.html`. When the resume changes, replace `public/resume.pdf` with a copy that has no phone number.

## Preview locally

```bash
python3 -m http.server 8000 --directory public
```

Then open http://localhost:8000.

## Deploy

Vercel deploys on push. `vercel.json` sets the framework preset to "Other", skips install and build, and serves `public/` as-is, so the Vercel project settings don't need changes.
