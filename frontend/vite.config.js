import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the frontend and the API run on different ports. The
// dev server forwards /api (and /media, the local development image
// store) to the backend, so the browser sees one origin: the session
// cookie is first-party and no CORS exception is needed. In
// production the host does the same forwarding (see
// docs/ALLSEMI-PRODUCTION-ARCHITECTURE.md).
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // lets you open the dev URL on your phone over LAN
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/media': { target: API_TARGET, changeOrigin: false },
    },
  },
});
