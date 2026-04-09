import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      external: ['/baremux/index.js', '/epoxy/index.mjs'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/games': 'http://localhost:3000',
      '/scram/': 'http://localhost:3000',
      '/uv/': 'http://localhost:3000',
      '/baremux/': 'http://localhost:3000',
      '/epoxy/': 'http://localhost:3000',
      '/wisp/': {
        target: 'http://localhost:3000',
        ws: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
