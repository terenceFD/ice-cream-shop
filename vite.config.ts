import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { BOOT_LOADER_BODY, BOOT_LOADER_HEAD } from './shared/bootLoader.js'

// Writes the website loader into index.html (see shared/bootLoader.js).
function bootLoader(): Plugin {
  return {
    name: 'boot-loader',
    transformIndexHtml(html) {
      if (!html.includes('<!--boot-loader-head-->') || !html.includes('<!--boot-loader-body-->')) {
        throw new Error('index.html is missing the boot-loader markers.')
      }
      return html
        .replace('<!--boot-loader-head-->', BOOT_LOADER_HEAD)
        .replace('<!--boot-loader-body-->', BOOT_LOADER_BODY)
    },
  }
}

export default defineConfig({
  plugins: [bootLoader(), tailwindcss(), react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      // Uploaded images are served by the API server in development.
      '/uploads': 'http://localhost:3001',
    },
  },
})
