import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    // Vite starts downloading the homepage chunk while the main bundle is still arriving instead of
    // waiting for it to finish; the other pages still download only when a visitor opens them.
    modulePreload: {
      resolveDependencies(_filename, dependencies) {
        return dependencies.filter((file) => file.includes('HomePage-'))
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      // Uploaded images are served by the API server in development.
      '/uploads': 'http://localhost:3001',
    },
  },
})
