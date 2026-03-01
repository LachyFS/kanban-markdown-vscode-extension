import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    globals: true,
    // Apply jsdom to webview tests, node to everything else
    environmentMatchGlobs: [
      ['tests/webview/**', 'jsdom'],
      ['tests/shared/**', 'node'],
      ['tests/extension/**', 'node']
    ],
    // Default environment for any test not matched above
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}'
    ],
    exclude: [
      'tests/integration/**',
      'node_modules/**'
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/**',
        'src/extension/featureFileUtils.ts',
        'src/webview/components/**',
        'src/webview/store/**'
      ],
      exclude: [
        'src/extension/index.ts',
        'src/extension/KanbanPanel.ts',
        'src/extension/SidebarViewProvider.ts',
        'src/extension/FeatureHeaderProvider.ts'
      ],
      reporter: ['text', 'html']
    }
  }
})
