import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Builds the dashboard into ../public/app, served by the Node server at /app. No build runs on the server.
export default defineConfig({
  base: '/app/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: '../public/app', emptyOutDir: true, chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], charts: ['recharts'], ui: ['radix-ui', 'sonner'], qr: ['qrcode'] } } },
  },
  server: { proxy: { '/v1': 'http://127.0.0.1:8401', '/cr': 'http://127.0.0.1:8401' } },
});
