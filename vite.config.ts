import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/model1': {
          target: process.env.VITE_MODEL1_API_URL || 'http://13.220.63.113:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/model1/, ''),
          timeout: 5000,
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              if (res && 'headersSent' in res && !res.headersSent) {
                (res as any).writeHead?.(502, { 'Content-Type': 'application/json' });
                (res as any).end?.(
                  JSON.stringify({
                    error: 'Model 1 backend host is currently unreachable or timed out.',
                    details: err.message,
                  })
                );
              }
            });
          },
        },
      },
    },
  };
});
