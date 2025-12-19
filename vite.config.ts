import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  root: '.',
  plugins: [react()],
  base: './', // مهم لـ Electron
  server: {
    port: 3000,
    https: false, // Keep as HTTP for development
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
        '**/.git/**',
        '**/electron/**'
      ]
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // تحسينات خاصة بـ Electron
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          antd: ['antd'],
          router: ['react-router-dom'],
          utils: ['axios', 'dayjs', 'date-fns']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
