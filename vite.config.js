import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Local DeepSeek analysis server lives on 3001 (npm run server).
      '/api': 'http://localhost:3001',
    },
  },
})
