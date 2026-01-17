import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,
    host: true, // Listen on all addresses
    allowedHosts: true, // Allow all hosts
    // Disable HMR for production-like access via domain
    hmr: false,
    proxy: {
      // Proxy API requests to the backend
      '/api': {
        target: 'http://cookbook-backend:4002',
        changeOrigin: true,
      },
    },
  },
})
