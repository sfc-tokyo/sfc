import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// GitHub Pages で https://<user>.github.io/sfc/ 配信のためのベース設定
export default defineConfig({
  base: '/sfc/',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        contact: resolve(__dirname, 'contact.html'),
        photos: resolve(__dirname, 'photos.html'),
        gallery: resolve(__dirname, 'gallery.html'),
        parents: resolve(__dirname, 'parents.html'),
      },
    },
  },
})
