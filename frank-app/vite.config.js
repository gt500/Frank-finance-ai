import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    env: {
      VITE_ANTHROPIC_API_KEY: 'test-key-123',
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
  server: {
    port: 3000,
    proxy: {
      // SimplePay is the only remaining direct-from-browser third-party call
      // (per-tenant key, opt-in via Connections). Anthropic and Wonderland
      // are proxied through Supabase edge functions now, not Vite.
      '/simplepay': {
        target: 'https://payroll.simplepay.cloud',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/simplepay/, ''),
      },
    },
  },
})
