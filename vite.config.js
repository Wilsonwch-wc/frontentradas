import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const realRoot = fs.realpathSync(process.cwd())
if (process.cwd() !== realRoot) {
  process.chdir(realRoot)
}

// https://vite.dev/config/
export default defineConfig({
  root: realRoot,
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
})

