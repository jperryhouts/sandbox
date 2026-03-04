# Sandbox Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a statically-hosted GitHub Pages portal with a sidebar-nav shell that loads independent mini web apps in iframes.

**Architecture:** Vite builds a minimal HTML/CSS/JS shell with a 200px sidebar and a full-height iframe main panel. Each app lives in `/apps/<name>/index.html` and is copied to `dist/apps/` via `vite-plugin-static-copy`. The app registry is a plain JS array in `src/main.js`; adding a new app requires one line there plus a folder.

**Tech Stack:** Vite 6, vite-plugin-static-copy, Vitest + jsdom (tests), GitHub Actions (deploy)

---

### Task 1: Initialize project structure and install dependencies

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/style.css`
- Create: `apps/lumber/index.html`
- Create: `.gitignore`

**Step 1: Scaffold package.json**

```bash
cd /workspace
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install --save-dev vite vite-plugin-static-copy vitest jsdom
```

Expected: packages installed, `node_modules/` created, `package-lock.json` created.

**Step 3: Update package.json scripts**

Edit `package.json` so the `"scripts"` section reads:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
```

**Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: initialize project with Vite and Vitest"
```

---

### Task 2: Configure Vite

**Files:**
- Create: `vite.config.js`

**Step 1: Write vite.config.js**

```js
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: '/sandbox/',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'apps', dest: '.' }
      ]
    })
  ],
  test: {
    environment: 'jsdom'
  }
})
```

**Step 2: Verify config is valid**

```bash
npx vite --version
```

Expected: prints Vite version without errors.

**Step 3: Commit**

```bash
git add vite.config.js
git commit -m "chore: configure Vite with base path and static-copy plugin"
```

---

### Task 3: Write failing tests for app registry and tab switching

**Files:**
- Create: `src/main.test.js`

**Step 1: Write tests**

Create `src/main.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'

// We'll import these once main.js exists
let apps, switchApp

beforeEach(async () => {
  // Reset DOM
  document.body.innerHTML = `
    <nav id="sidebar">
      <ul id="tab-list"></ul>
    </nav>
    <iframe id="app-frame"></iframe>
  `
  // Re-import fresh module
  const mod = await import('./main.js?t=' + Date.now())
  apps = mod.apps
  switchApp = mod.switchApp
})

describe('app registry', () => {
  it('exports a non-empty apps array', () => {
    expect(Array.isArray(apps)).toBe(true)
    expect(apps.length).toBeGreaterThan(0)
  })

  it('each app has id, label, and src', () => {
    for (const app of apps) {
      expect(typeof app.id).toBe('string')
      expect(typeof app.label).toBe('string')
      expect(typeof app.src).toBe('string')
    }
  })
})

describe('switchApp', () => {
  it('sets the iframe src to the app src', () => {
    const frame = document.getElementById('app-frame')
    switchApp(apps[0])
    expect(frame.src).toContain(apps[0].src.replace(/^\//, ''))
  })

  it('marks the active tab with aria-current', () => {
    // Build tabs first (init would do this, but test switchApp directly)
    const list = document.getElementById('tab-list')
    apps.forEach(app => {
      const li = document.createElement('li')
      li.dataset.id = app.id
      list.appendChild(li)
    })
    switchApp(apps[0])
    const activeTab = document.querySelector(`[data-id="${apps[0].id}"]`)
    expect(activeTab.getAttribute('aria-current')).toBe('page')
  })
})
```

**Step 2: Run tests — expect failure**

```bash
npm test
```

Expected: FAIL — `Cannot find module './main.js'`

**Step 3: Commit the failing tests**

```bash
git add src/main.test.js
git commit -m "test: add failing tests for app registry and tab switching"
```

---

### Task 4: Implement app registry and tab switching

**Files:**
- Create: `src/main.js`

**Step 1: Write src/main.js**

```js
export const apps = [
  {
    id: 'lumber',
    label: 'Lumber Optimizer',
    src: '/sandbox/apps/lumber/index.html',
  },
]

const frame = document.getElementById('app-frame')
const tabList = document.getElementById('tab-list')

export function switchApp(app) {
  frame.src = app.src

  document.querySelectorAll('#tab-list li').forEach(el => {
    el.removeAttribute('aria-current')
  })

  const activeTab = tabList.querySelector(`[data-id="${app.id}"]`)
  if (activeTab) activeTab.setAttribute('aria-current', 'page')
}

function init() {
  apps.forEach(app => {
    const li = document.createElement('li')
    li.textContent = app.label
    li.dataset.id = app.id
    li.addEventListener('click', () => switchApp(app))
    tabList.appendChild(li)
  })

  if (apps.length > 0) switchApp(apps[0])
}

init()
```

**Step 2: Run tests — expect pass**

```bash
npm test
```

Expected: all 4 tests PASS.

**Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: implement app registry and tab switching"
```

---

### Task 5: Create shell HTML and CSS

**Files:**
- Create: `index.html`
- Create: `src/style.css`

**Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sandbox</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <nav id="sidebar">
    <div id="sidebar-header">Sandbox</div>
    <ul id="tab-list"></ul>
  </nav>
  <main id="main-panel">
    <iframe id="app-frame" title="App"></iframe>
  </main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

**Step 2: Write src/style.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  color: #1a1a1a;
  background: #f5f5f5;
}

body {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

#sidebar {
  width: 200px;
  flex-shrink: 0;
  background: #efefef;
  border-right: 1px solid #d8d8d8;
  display: flex;
  flex-direction: column;
}

#sidebar-header {
  padding: 16px;
  font-weight: 600;
  font-size: 15px;
  border-bottom: 1px solid #d8d8d8;
  color: #111;
}

#tab-list {
  list-style: none;
  padding: 8px 0;
  flex: 1;
  overflow-y: auto;
}

#tab-list li {
  padding: 8px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  color: #444;
  transition: background 0.1s;
}

#tab-list li:hover {
  background: #e4e4e4;
}

#tab-list li[aria-current="page"] {
  border-left-color: #2563eb;
  background: #e8eef9;
  color: #1a1a1a;
  font-weight: 500;
}

#main-panel {
  flex: 1;
  display: flex;
  overflow: hidden;
}

#app-frame {
  flex: 1;
  border: none;
  background: #fff;
}
```

**Step 3: Verify dev server works**

```bash
npm run dev
```

Open the printed localhost URL in a browser. You should see the sidebar with "Lumber Optimizer" tab and an iframe (will be blank or error until the lumber app exists — that's fine).

Press Ctrl+C to stop the server.

**Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "feat: add shell HTML layout and minimal CSS"
```

---

### Task 6: Create lumber optimizer placeholder

**Files:**
- Create: `apps/lumber/index.html`

**Step 1: Write apps/lumber/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lumber Optimizer</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #fff;
      color: #444;
    }
    h1 { font-size: 1.2rem; font-weight: 500; }
  </style>
</head>
<body>
  <h1>Lumber Optimizer — coming soon</h1>
</body>
</html>
```

**Step 2: Verify full dev flow**

```bash
npm run dev
```

Open the localhost URL. You should see:
- Left sidebar with "Lumber Optimizer" tab highlighted
- Iframe showing the "coming soon" message

Press Ctrl+C.

**Step 3: Commit**

```bash
git add apps/lumber/index.html
git commit -m "feat: add lumber optimizer placeholder app"
```

---

### Task 7: Verify production build

**Step 1: Run build**

```bash
npm run build
```

Expected: `dist/` folder created. Verify it contains:

```bash
ls dist/
# Should show: index.html, assets/, apps/
ls dist/apps/lumber/
# Should show: index.html
```

**Step 2: Preview the build**

```bash
npm run preview
```

Open the printed URL (will be something like `http://localhost:4173/sandbox/`). Verify the full app works — sidebar tab loads the lumber placeholder in the iframe.

Press Ctrl+C.

**Step 3: Commit**

No new files to commit (dist/ is gitignored). Move on.

---

### Task 8: Add GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create workflow directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Write .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy workflow for GitHub Pages"
```

---

### Task 9: Create GitHub repo and push

**Step 1: Create the repo using GitHub CLI**

```bash
gh repo create sandbox --public --description "A personal portal for browser-based mini tools"
```

Expected: repo created at `https://github.com/<your-username>/sandbox`

**Step 2: Add remote and push**

```bash
git remote add origin https://github.com/<your-username>/sandbox.git
git push -u origin main
```

Replace `<your-username>` with your actual GitHub username.

**Step 3: Enable GitHub Pages in repo settings**

Go to: `https://github.com/<your-username>/sandbox/settings/pages`

- Under **Source**, select **GitHub Actions**
- Save

**Step 4: Verify deployment**

The push to `main` will have triggered the workflow. Check it at:

```bash
gh run list --repo <your-username>/sandbox
```

Once the run shows `completed`, visit `https://<your-username>.github.io/sandbox/` — you should see the working portal.
