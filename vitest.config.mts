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
      ['src/webview/**', 'jsdom'],
      ['src/shared/**', 'node'],
      ['src/extension/**', 'node']
    ],
    // Default environment for any test not matched above
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}'
    ],
    exclude: [
      'src/test/integration/**',
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
