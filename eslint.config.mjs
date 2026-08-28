import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh,
      'simple-import-sort': eslintPluginSimpleImportSort,
      'unused-imports': eslintPluginUnusedImports
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side-effect imports (e.g. CSS).
            ['^\\u0000'],
            // React first.
            ['^react$', '^react-dom'],
            // Everything else from node_modules
            ['^(?!@(renderer|shared|components|state|hooks|utils|main|preload)(/|$))@?\\w'],
            // This project's absolute aliases.
            ['^@(renderer|shared|components|state|hooks|utils|main|preload)(/|$)'],
            // Parent-relative, then same-folder relative imports.
            ['^\\.\\.(?!/?$)', '^\\.\\./?$', '^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$']
          ]
        }
      ],
      'simple-import-sort/exports': 'error',
      // Always import via an absolute alias (@renderer, @shared, @state,
      // ...) instead of reaching up out of the current folder with "../" —
      // `regex` matches the literal specifier text, not where it resolves
      // to, so an alias that happens to point "upward" in the physical
      // folder tree (e.g. @shared/types from deep inside components/) is
      // unaffected. Same-directory "./foo" imports are still fine.
      //
      // @components, @state, @hooks, and @utils are additionally barrel-only
      // (see their index.ts) — import the barrel, not a specific file inside
      // it. @shared is intentionally not restricted this way: it's a
      // collection of independently-meaningful modules (e.g. "@shared/types"),
      // not a single cohesive API worth flattening into one barrel.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./',
              message:
                'Use an absolute alias import (e.g. "@state", "@shared/...") instead of a relative parent import ("../...").'
            },
            {
              group: ['@components/*'],
              message: 'Import from the "@components" barrel instead of a specific file inside it.'
            },
            {
              group: ['@state/*'],
              message: 'Import from the "@state" barrel instead of a specific file inside it.'
            },
            {
              group: ['@hooks/*'],
              message: 'Import from the "@hooks" barrel instead of a specific file inside it.'
            },
            {
              group: ['@utils/*'],
              message: 'Import from the "@utils" barrel instead of a specific file inside it.'
            }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
