import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config with a dev proxy so client requests to `/api/*` are forwarded to the backend
// This helps avoid CORS problems during local development. Production should use the
// real API URL (set via .env.production or your deployment pipeline).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    // Force dev server to run on port 5176 for local testing consistency
    port: 5176,
    // Only enable proxy in development
    proxy: mode === 'development' ? {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        // rewrite: path => path.replace(/^\/api/, '/api') // not necessary here
      },
    } : undefined,
  },
  // Ensure preview (static preview) runs on the same port by default
  preview: {
    port: 5176,
  },
}))
