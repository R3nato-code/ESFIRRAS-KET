import { defineConfig } from 'vitest/config'

/* Testes das REGRAS do Firestore (não do app).
   Rodam contra o Emulador do Firestore, iniciado por:
     npm --prefix admin run test:rules
   Exigem Java 11+ (requisito do emulador). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    restoreMocks: true,
  },
})
