import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    // Renderer/shared code runs under jsdom (DOM APIs, React) by default.
    // Main-process test files opt into plain node instead (no DOM, and they
    // import Node-only modules like better-sqlite3/sharp that don't work
    // under jsdom) via a `// @vitest-environment node` docblock at the top
    // of each file — environmentMatchGlobs was removed in Vitest 4.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/renderer/src/main.tsx',
        'src/preload/**',
        'src/main/index.ts'
      ],
      thresholds: {
        lines: 30,
        statements: 30,
        functions: 30,
        branches: 30
      }
    }
  }
})
