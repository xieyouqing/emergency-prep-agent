import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      // DSH 原子写会在项目根留下 `.AGENTS.md.<pid>.<uuid>.tmpdir` 之类的临时目录，
      // Vite 默认会去 watch，拿到 EBUSY 直接崩进程。跳过它们。
      ignored: ['**/.git/**', '**/node_modules/**', '**/*.tmpdir/**', '**/.*.tmpdir/**', '**/*.tmp'],
    },
  },
})
