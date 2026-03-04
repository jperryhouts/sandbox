import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let apps, switchApp, init

beforeEach(async () => {
  document.body.innerHTML = `
    <nav id="sidebar">
      <ul id="tab-list"></ul>
    </nav>
    <iframe id="app-frame"></iframe>
  `
  const mod = await import('./main.js?t=' + Date.now())
  apps = mod.apps
  switchApp = mod.switchApp
  init = mod.init
})

describe('app registry', () => {
  it('has no duplicate app IDs', () => {
    const ids = apps.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each src follows the /sandbox/apps/<id>/index.html pattern', () => {
    for (const app of apps) {
      expect(app.src).toBe(`/sandbox/apps/${app.id}/index.html`)
    }
  })

  it('each registered app has an index.html on disk', () => {
    for (const app of apps) {
      const filePath = resolve(projectRoot, 'apps', app.id, 'index.html')
      expect(existsSync(filePath), `apps/${app.id}/index.html should exist`).toBe(true)
    }
  })
})

describe('init()', () => {
  it('creates exactly one tab per registered app', () => {
    init()
    const tabs = document.querySelectorAll('#tab-list li')
    expect(tabs.length).toBe(apps.length)
  })

  it('each tab has the correct data-id', () => {
    init()
    for (const app of apps) {
      const tab = document.querySelector(`[data-id="${app.id}"]`)
      expect(tab).not.toBeNull()
    }
  })

  it('each tab displays the app label', () => {
    init()
    for (const app of apps) {
      const tab = document.querySelector(`[data-id="${app.id}"]`)
      expect(tab.textContent).toBe(app.label)
    }
  })

  it('auto-loads the first app in the iframe', () => {
    init()
    const frame = document.getElementById('app-frame')
    expect(frame.src).toContain(apps[0].src.replace(/^\//, ''))
  })

  it('marks the first app tab as active', () => {
    init()
    const firstTab = document.querySelector(`[data-id="${apps[0].id}"]`)
    expect(firstTab.getAttribute('aria-current')).toBe('page')
  })
})

describe('tab switching', () => {
  it('clears aria-current from the previously active tab', () => {
    const tabList = document.getElementById('tab-list')
    apps.forEach(app => {
      const li = document.createElement('li')
      li.dataset.id = app.id
      tabList.appendChild(li)
    })
    if (apps.length >= 2) {
      switchApp(apps[0])
      switchApp(apps[1])
      const prevTab = document.querySelector(`[data-id="${apps[0].id}"]`)
      expect(prevTab.getAttribute('aria-current')).toBeNull()
    } else {
      // Only one app registered — skip multi-app assertion
      expect(apps.length).toBeGreaterThan(0)
    }
  })

  it('only one tab is marked active at a time', () => {
    init()
    if (apps.length >= 2) {
      switchApp(apps[1])
      const activeTabs = document.querySelectorAll('[aria-current="page"]')
      expect(activeTabs.length).toBe(1)
    } else {
      switchApp(apps[0])
      const activeTabs = document.querySelectorAll('[aria-current="page"]')
      expect(activeTabs.length).toBe(1)
    }
  })

  it('updates the iframe src when switching apps', () => {
    init()
    if (apps.length >= 2) {
      switchApp(apps[1])
      const frame = document.getElementById('app-frame')
      expect(frame.src).toContain(apps[1].src.replace(/^\//, ''))
    } else {
      switchApp(apps[0])
      const frame = document.getElementById('app-frame')
      expect(frame.src).toContain(apps[0].src.replace(/^\//, ''))
    }
  })
})
