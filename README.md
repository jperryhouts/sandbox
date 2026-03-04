# Sandbox

A statically-hosted portal for browser-based mini tools, deployed to GitHub Pages.

## What it is

A sidebar-nav shell that loads independent mini web apps in iframes. Each app is a self-contained HTML page with its own styles and scripts, isolated from the shell and from each other.

Live site: **https://jperryhouts.github.io/sandbox/**

## Apps

| App | Description |
|-----|-------------|
| Lumber Optimizer | *(coming soon)* |

## Adding a new app

1. Create `apps/<name>/index.html` — self-contained, any tech stack
2. Add one entry to the registry array in `src/main.js`:
   ```js
   { id: 'name', label: 'Display Name', src: '/sandbox/apps/name/index.html' }
   ```

That's it. The build copies `apps/` into `dist/apps/` automatically.

## Development

```bash
npm install
npm run dev       # http://localhost:5173/sandbox/
npm test          # run all tests
npm run build     # build to dist/
npm run preview   # preview production build at http://localhost:4173/sandbox/
```

## Architecture

```
index.html          ← shell entry point
src/
  main.js           ← app registry + tab-switching logic
  style.css         ← shell styles (200px sidebar + full-height iframe)
apps/
  <name>/
    index.html      ← each app is a self-contained page
vite.config.js      ← base: '/sandbox/', copies apps/ to dist/
.github/
  workflows/
    deploy.yml      ← build + deploy to GitHub Pages on push to main
```

The shell is plain HTML/CSS/JS (no framework). Apps are isolated via iframes — each gets its own JS context and the browser manages their lifecycle.

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that runs `npm run build` and deploys `dist/` to GitHub Pages. No manual steps required after the initial Pages setup (Settings → Pages → Source → GitHub Actions).
