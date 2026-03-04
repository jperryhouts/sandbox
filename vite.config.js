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
