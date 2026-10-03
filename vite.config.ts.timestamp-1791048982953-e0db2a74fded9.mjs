// vite.config.ts
import { defineConfig } from "file:///H:/My%20Work/Naruto/New%20folder%20(2)/project/node_modules/vite/dist/node/index.js";
import react from "file:///H:/My%20Work/Naruto/New%20folder%20(2)/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import compression from "file:///H:/My%20Work/Naruto/New%20folder%20(2)/project/node_modules/vite-plugin-compression/dist/index.mjs";
var vite_config_default = defineConfig({
  root: ".",
  plugins: [
    react(),
    compression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 10240
    }),
    compression({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 10240
    })
  ],
  server: {
    port: 3e3,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false
      },
      "/socket.io": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        ws: true
      }
    },
    watch: {
      ignored: [
        "**/setup-replica-set.ps1",
        "**/setup-replica-set.cmd",
        "**/node_modules/**",
        "**/.git/**"
      ]
    }
  },
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    chunkSizeWarningLimit: 1e3,
    cssCodeSplit: true,
    rollupOptions: {
      // درس مستفاد: التقسيم اليدوي للمكتبات (manualChunks) كسر بدء التطبيق
      // (دائرة vendor-react ↔ vendor العام أعطت "useState of undefined").
      // التقسيم التلقائي يدمج الدوائر بأمان. نمنع أي دائرة تمس مدار React.
      onwarn(warning, warn) {
        if (warning.code === "CIRCULAR_DEPENDENCY" && /node_modules[\\/](react|react-dom|react-router-dom|scheduler|react-i18next|i18next|use-sync-external-store)\b/.test(warning.message)) {
          throw new Error(`React-orbit circular dependency blocked: ${warning.message}`);
        }
        warn(warning);
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJIOlxcXFxNeSBXb3JrXFxcXE5hcnV0b1xcXFxOZXcgZm9sZGVyICgyKVxcXFxwcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJIOlxcXFxNeSBXb3JrXFxcXE5hcnV0b1xcXFxOZXcgZm9sZGVyICgyKVxcXFxwcm9qZWN0XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9IOi9NeSUyMFdvcmsvTmFydXRvL05ldyUyMGZvbGRlciUyMCgyKS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCBjb21wcmVzc2lvbiBmcm9tICd2aXRlLXBsdWdpbi1jb21wcmVzc2lvbic7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHJvb3Q6ICcuJyxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgY29tcHJlc3Npb24oe1xyXG4gICAgICBhbGdvcml0aG06ICdnemlwJyxcclxuICAgICAgZXh0OiAnLmd6JyxcclxuICAgICAgdGhyZXNob2xkOiAxMDI0MCxcclxuICAgIH0pLFxyXG4gICAgY29tcHJlc3Npb24oe1xyXG4gICAgICBhbGdvcml0aG06ICdicm90bGlDb21wcmVzcycsXHJcbiAgICAgIGV4dDogJy5icicsXHJcbiAgICAgIHRocmVzaG9sZDogMTAyNDAsXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcG9ydDogMzAwMCxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NTAwMCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgICcvc29ja2V0LmlvJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NTAwMCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgd3M6IHRydWUsXHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICB3YXRjaDoge1xyXG4gICAgICBpZ25vcmVkOiBbXHJcbiAgICAgICAgJyoqL3NldHVwLXJlcGxpY2Etc2V0LnBzMScsXHJcbiAgICAgICAgJyoqL3NldHVwLXJlcGxpY2Etc2V0LmNtZCcsXHJcbiAgICAgICAgJyoqL25vZGVfbW9kdWxlcy8qKicsXHJcbiAgICAgICAgJyoqLy5naXQvKionXHJcbiAgICAgIF1cclxuICAgIH1cclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgZXhjbHVkZTogWydsdWNpZGUtcmVhY3QnXSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXHJcbiAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIC8vIFx1MDYyRlx1MDYzMVx1MDYzMyBcdTA2NDVcdTA2MzNcdTA2MkFcdTA2NDFcdTA2MjdcdTA2MkY6IFx1MDYyN1x1MDY0NFx1MDYyQVx1MDY0Mlx1MDYzM1x1MDY0QVx1MDY0NSBcdTA2MjdcdTA2NDRcdTA2NEFcdTA2MkZcdTA2NDhcdTA2NEEgXHUwNjQ0XHUwNjQ0XHUwNjQ1XHUwNjQzXHUwNjJBXHUwNjI4XHUwNjI3XHUwNjJBIChtYW51YWxDaHVua3MpIFx1MDY0M1x1MDYzM1x1MDYzMSBcdTA2MjhcdTA2MkZcdTA2MjEgXHUwNjI3XHUwNjQ0XHUwNjJBXHUwNjM3XHUwNjI4XHUwNjRBXHUwNjQyXHJcbiAgICAgIC8vIChcdTA2MkZcdTA2MjdcdTA2MjZcdTA2MzFcdTA2MjkgdmVuZG9yLXJlYWN0IFx1MjE5NCB2ZW5kb3IgXHUwNjI3XHUwNjQ0XHUwNjM5XHUwNjI3XHUwNjQ1IFx1MDYyM1x1MDYzOVx1MDYzN1x1MDYyQSBcInVzZVN0YXRlIG9mIHVuZGVmaW5lZFwiKS5cclxuICAgICAgLy8gXHUwNjI3XHUwNjQ0XHUwNjJBXHUwNjQyXHUwNjMzXHUwNjRBXHUwNjQ1IFx1MDYyN1x1MDY0NFx1MDYyQVx1MDY0NFx1MDY0Mlx1MDYyN1x1MDYyNlx1MDY0QSBcdTA2NEFcdTA2MkZcdTA2NDVcdTA2MkMgXHUwNjI3XHUwNjQ0XHUwNjJGXHUwNjQ4XHUwNjI3XHUwNjI2XHUwNjMxIFx1MDYyOFx1MDYyM1x1MDY0NVx1MDYyN1x1MDY0Ni4gXHUwNjQ2XHUwNjQ1XHUwNjQ2XHUwNjM5IFx1MDYyM1x1MDY0QSBcdTA2MkZcdTA2MjdcdTA2MjZcdTA2MzFcdTA2MjkgXHUwNjJBXHUwNjQ1XHUwNjMzIFx1MDY0NVx1MDYyRlx1MDYyN1x1MDYzMSBSZWFjdC5cclxuICAgICAgb253YXJuKHdhcm5pbmcsIHdhcm4pIHtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICB3YXJuaW5nLmNvZGUgPT09ICdDSVJDVUxBUl9ERVBFTkRFTkNZJyAmJlxyXG4gICAgICAgICAgL25vZGVfbW9kdWxlc1tcXFxcL10ocmVhY3R8cmVhY3QtZG9tfHJlYWN0LXJvdXRlci1kb218c2NoZWR1bGVyfHJlYWN0LWkxOG5leHR8aTE4bmV4dHx1c2Utc3luYy1leHRlcm5hbC1zdG9yZSlcXGIvLnRlc3Qod2FybmluZy5tZXNzYWdlKVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZWFjdC1vcmJpdCBjaXJjdWxhciBkZXBlbmRlbmN5IGJsb2NrZWQ6ICR7d2FybmluZy5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3YXJuKHdhcm5pbmcpO1xyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFQsU0FBUyxvQkFBb0I7QUFDdlYsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBR3hCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxNQUNWLFdBQVc7QUFBQSxNQUNYLEtBQUs7QUFBQSxNQUNMLFdBQVc7QUFBQSxJQUNiLENBQUM7QUFBQSxJQUNELFlBQVk7QUFBQSxNQUNWLFdBQVc7QUFBQSxNQUNYLEtBQUs7QUFBQSxNQUNMLFdBQVc7QUFBQSxJQUNiLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ1osUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsSUFBSTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGNBQWM7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsdUJBQXVCO0FBQUEsSUFDdkIsY0FBYztBQUFBLElBQ2QsZUFBZTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BSWIsT0FBTyxTQUFTLE1BQU07QUFDcEIsWUFDRSxRQUFRLFNBQVMseUJBQ2pCLGdIQUFnSCxLQUFLLFFBQVEsT0FBTyxHQUNwSTtBQUNBLGdCQUFNLElBQUksTUFBTSw0Q0FBNEMsUUFBUSxPQUFPLEVBQUU7QUFBQSxRQUMvRTtBQUNBLGFBQUssT0FBTztBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
