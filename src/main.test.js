import { describe, it, expect, beforeEach } from 'vitest'

let apps, switchApp

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
