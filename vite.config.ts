import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base: '/REPO_NAME/' se ajusta en package.json -> ver README para GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
