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
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
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
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    rollupOptions: {
      // درس مستفاد: التقسيم اليدوي للمكتبات (manualChunks) كسر بدء التطبيق
      // (دائرة vendor-react ↔ vendor العام أعطت "useState of undefined").
      // التقسيم التلقائي يدمج الدوائر بأمان. نمنع أي دائرة تمس مدار React.
      onwarn(warning, warn) {
        if (
          warning.code === 'CIRCULAR_DEPENDENCY' &&
          /node_modules[\\/](react|react-dom|react-router-dom|scheduler|react-i18next|i18next|use-sync-external-store)\b/.test(warning.message)
        ) {
          throw new Error(`React-orbit circular dependency blocked: ${warning.message}`);
        }
        warn(warning);
      },
    },
  },
});
