import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Backend-Routen liegen unter /api, /health bleibt eigenständig.
    proxy: {
      '/health': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
});
