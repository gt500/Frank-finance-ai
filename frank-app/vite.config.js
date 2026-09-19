import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_ANTHROPIC_API_KEY': JSON.stringify('test-key-123'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://test-project.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
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
