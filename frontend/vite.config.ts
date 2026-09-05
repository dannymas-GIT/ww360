import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Vite 6 crawls every *.html for dependency scanning by default; static docs under
  // public/ and debug pages then trigger huge scans and can race the dev server closed.
  optimizeDeps: {
    entries: ['index.html'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    // Remote dev VMs often hit fs.inotify max_user_watches (ENOSPC); polling avoids that.
    watch: {
      usePolling: true,
      interval: 1000,
    },
    // Dev: allow localhost, tailnet IP, MagicDNS (short + .ts.net), VM port-forward, Cursor tunnels.
    // A strict allowlist broke access via aquasafedev6:5174 and some forwarded-port Host headers.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        configure: proxy => {
          // Forward tailnet client IP when phones/tablets hit Vite directly (:5174 dev path).
          proxy.on('proxyReq', (proxyReq, req) => {
            const raw = req.socket?.remoteAddress ?? '';
            const clientIp = raw.replace(/^::ffff:/, '');
            if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
              proxyReq.setHeader('X-Real-IP', clientIp);
              proxyReq.setHeader('X-Forwarded-For', clientIp);
            }
          });
        },
      },
    },
  },
});
