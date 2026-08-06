import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    resolve: {
      alias: [
        { find: '@shared', replacement: resolve('src/shared') },
        { find: '@main', replacement: resolve('src/main') }
      ]
    },
    // Extra entry so the worker_thread (spawned at runtime via a plain file
    // path, not an import) gets emitted as its own out/main/*.js alongside
    // the default index entry.
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          tagSuggestionWorker: resolve('src/main/workers/tagSuggestionWorker.ts')
        }
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: {
      alias: [
        { find: '@shared', replacement: resolve('src/shared') },
        { find: '@preload', replacement: resolve('src/preload') }
      ]
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: [
        { find: '@renderer', replacement: resolve('src/renderer/src') },
        { find: '@shared', replacement: resolve('src/shared') },
        // Exact-match only (anchored regex, no prefix matching) — these
        // four are barrel-only, so the underlying bundler rejects a deep
        // import the same way tsconfig's paths (bare specifier, no "/*")
        // does at typecheck time.
        {
          find: /^@components$/,
          replacement: resolve('src/renderer/src/components/index.ts')
        },
        { find: /^@state$/, replacement: resolve('src/renderer/src/state/index.ts') },
        { find: /^@hooks$/, replacement: resolve('src/renderer/src/hooks/index.ts') },
        { find: /^@utils$/, replacement: resolve('src/renderer/src/utils/index.ts') }
      ]
    },
    plugins: [react()]
  }
})
