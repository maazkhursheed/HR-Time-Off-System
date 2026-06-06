import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // jsdom provides browser globals (fetch, sessionStorage, crypto.randomUUID)
    // and is required for React hook tests. Pure Node logic tests can opt out
    // with // @vitest-environment node at the top of the file.
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // Relative fetch calls (e.g. /api/hcm/...) resolve against this origin
        url: 'http://localhost:3000',
      },
    },
    globals: true,
    setupFiles: ['__tests__/setup.ts'],
    // Treat @/ path alias the same as in the app
    alias: { '@/': new URL('./', import.meta.url).pathname },
  },
})
