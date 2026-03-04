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

  document.querySelectorAll('#tab-list li').forEach(el => {
    el.removeAttribute('aria-current')
  })

  const activeTab = tabList.querySelector(`[data-id="${app.id}"]`)
  if (activeTab) activeTab.setAttribute('aria-current', 'page')
}

function init() {
  const tabList = document.getElementById('tab-list')

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
