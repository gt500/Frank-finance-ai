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
    // Proxy Anthropic API calls to avoid CORS in development
    proxy: {
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, ''),
        headers: {
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      },
      '/wl-api': {
        target: 'https://wonderland-management.replit.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wl-api/, ''),
      },
      '/simplepay': {
        target: 'https://payroll.simplepay.cloud',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/simplepay/, ''),
      },
    },
  },
})
