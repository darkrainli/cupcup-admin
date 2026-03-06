import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // 完全不降级 class，避免 "Class constructor cannot be invoked without 'new'"
  },
  optimizeDeps: {
    include: ['react-easy-crop'],
  },
})
