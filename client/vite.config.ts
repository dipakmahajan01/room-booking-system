import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly: on Windows "localhost" can resolve to ::1 only.
    host: '127.0.0.1',
    port: 5173,
    // Forward /api calls to the Express server, so the browser sees one origin.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
