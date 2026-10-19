import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } }, // shadcn-style imports: @/components/ui/...
  server: {
    port: 5173,
    host: true,
    // Dev: with VITE_API_URL=/api, calls go to this server and on to the backend, so the app
    // works from any address (localhost, the PC's Wi-Fi IP, a phone) with no CORS setup.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
