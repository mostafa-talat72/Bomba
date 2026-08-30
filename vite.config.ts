import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  root: '.',
  plugins: [
    react(),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240,
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      ignored: [
        '**/setup-replica-set.ps1',
        '**/setup-replica-set.cmd',
        '**/node_modules/**',
        '**/.git/**'
      ]
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('antd') || id.includes('@ant-design/icons')) return 'vendor-antd';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('jspdf') || id.includes('jspdf-autotable') || id.includes('xlsx') || id.includes('qrcode')) return 'vendor-heavy';
            return 'vendor-core';
          }
        },
      },
    },
  },
});
