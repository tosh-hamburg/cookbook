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
      // MCP server (Claude integration). It lives under /mcp on this very
      // domain so its Google sign-in page shares the site's origin - the
      // existing Google client ID needs no extra JavaScript origin.
      '/mcp': {
        target: 'http://cookbook-mcp:4003',
        changeOrigin: false,
      },
      // OAuth discovery documents must sit at the domain root (RFC 8414 and
      // RFC 9728), so they are forwarded as well.
      '/.well-known/oauth-authorization-server': {
        target: 'http://cookbook-mcp:4003',
        changeOrigin: false,
      },
      '/.well-known/oauth-protected-resource': {
        target: 'http://cookbook-mcp:4003',
        changeOrigin: false,
      },
    },
  },
})
