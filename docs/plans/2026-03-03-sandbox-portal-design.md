# Sandbox Portal — Design Document

**Date:** 2026-03-03

## Overview

A statically-hosted web portal (GitHub Pages) that provides a sidebar-nav shell for loading independent mini web apps. The first app is a lumber cutting optimizer. Future apps may include games, data visualization tools, or other browser-only utilities.

## Key Constraints

- Fully static — no server backend, deployable to GitHub Pages
- Apps must be independent: isolated JS contexts, low memory footprint
- Build step is acceptable; keep it maintainable

## Architecture

**Shell + iframes.** The outer shell is a minimal Vite-built HTML/CSS/JS page with a sidebar nav. Each mini-app lives in its own subdirectory under `/apps/` as a self-contained `index.html`. Clicking a sidebar tab swaps the iframe `src`. No framework in the shell.

This model gives true JS isolation between apps — the browser manages each app's lifecycle. Apps can use any tech internally without affecting the shell or each other.

## Project Structure

```
sandbox/
├── index.html              # shell entry point
├── src/
│   ├── main.js             # tab switching + app registry
│   └── style.css           # shell styles only
├── apps/
│   └── lumber/
│       └── index.html      # first mini-app (self-contained)
├── public/                 # static assets copied as-is by Vite
├── vite.config.js
├── package.json
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Actions → GitHub Pages
```

## App Registry

Apps are registered in `src/main.js` as a plain array:

```js
const apps = [
  { id: 'lumber', label: 'Lumber Optimizer', src: '/apps/lumber/index.html' },
];
```

Adding a new app = one line in the registry + a folder under `/apps/`.

## Shell UI

```
┌─────────────────────────────────────────────────────┐
│  sidebar (200px)  │  main panel (flex-fill)          │
│  ─────────────── │  ──────────────────────────────  │
│  Sandbox         │                                   │
│  ─────────────── │   <iframe src="apps/lumber/">     │
│  > Lumber Opt.   │                                   │
│    [future app]  │                                   │
│                  │                                   │
└─────────────────────────────────────────────────────┘
```

- Sidebar: fixed 200px, light neutral background, app name at top, tab list below
- Active tab: left-border accent + slightly darker background
- Main panel: iframe fills 100% of remaining space, no border/padding
- No top navbar — sidebar title is the branding
- First app in registry loads automatically on page load

## Visual Design

Clean and minimal. Neutral colors, no animations, no dropdowns, no extra chrome.

## Deployment

- **Build tool:** Vite
- **App assets:** `vite-plugin-static-copy` copies `apps/` → `dist/apps/` during build
- **Base path:** `base: '/sandbox/'` in `vite.config.js` for correct asset resolution on GitHub Pages
- **CI/CD:** GitHub Actions on push to `main` — runs `npm run build`, deploys `dist/` via `actions/deploy-pages`
- **Dev:** `vite dev` serves shell + apps locally; iframe works in development

## Adding Future Apps

1. Create `/apps/<name>/index.html` (self-contained)
2. Add one entry to the registry array in `src/main.js`
