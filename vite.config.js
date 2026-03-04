import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { rm } from 'node:fs/promises'
import { glob } from 'tinyglobby'
import { resolve } from 'node:path'

function excludeTestFilesFromDist() {
  return {
    name: 'exclude-test-files-from-dist',
    apply: 'build',
    async closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')
      const testFiles = await glob(['apps/**/*.test.js'], {
        cwd: outDir,
        dot: true,
      })
      for (const file of testFiles) {
        await rm(resolve(outDir, file), { force: true })
      }
    },
  }
}

export default defineConfig({
  base: '/sandbox/',
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'apps', dest: '.' }
      ]
    }),
    excludeTestFilesFromDist(),
  ],
  test: {
    environment: 'jsdom'
  }
})
