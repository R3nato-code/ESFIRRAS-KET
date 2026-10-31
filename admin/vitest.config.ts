import { defineConfig } from 'vitest/config'

/* Configuração separada do vite.config.ts de propósito: os testes de
   domínio são puros e não exigem as variáveis VITE_FIREBASE_* (o
   vite.config do app falha cedo quando elas não existem). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
