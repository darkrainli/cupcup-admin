import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 避免 "Class constructor cannot be invoked without 'new'"：不把 class 转成 ES5，与 react-easy-crop / 部分依赖兼容
    target: 'es2020',
  },
  optimizeDeps: {
    include: ['react-easy-crop', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  },
})
