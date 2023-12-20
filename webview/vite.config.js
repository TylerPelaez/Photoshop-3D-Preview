import { defineConfig } from 'vite'

// vite.config.js
export default defineConfig({
  server: {
    watch: {
      usePolling: true
    }
  }
})