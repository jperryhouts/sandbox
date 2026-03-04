export const apps = [
  {
    id: 'lumber',
    label: 'Lumber Optimizer',
    src: '/sandbox/apps/lumber/index.html',
  },
]

export function switchApp(app) {
  const frame = document.getElementById('app-frame')
  const tabList = document.getElementById('tab-list')

  frame.src = app.src

  tabList.querySelectorAll('li').forEach(el => {
    el.removeAttribute('aria-current')
  })

  const activeTab = tabList.querySelector(`[data-id="${app.id}"]`)
  if (activeTab) activeTab.setAttribute('aria-current', 'page')
}

export function init() {
  apps.forEach(app => {
    const li = document.createElement('li')
    li.textContent = app.label
    li.dataset.id = app.id
    li.addEventListener('click', () => switchApp(app))
    document.getElementById('tab-list').appendChild(li)
  })

  if (apps.length > 0) switchApp(apps[0])
}
