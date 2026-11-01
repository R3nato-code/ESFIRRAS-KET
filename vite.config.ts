import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { pwaPlugin } from './scripts/pwa-plugin.ts'

/* Chaves exigidas pelo app (Firebase Web SDK). */
const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

export default defineConfig(({ mode }) => {
  /* Falha cedo (dev e build) se o Firebase não estiver configurado.
     Sem isso a página sobe e só quebra em runtime, com tela branca. */
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim())

  if (missing.length > 0) {
    throw new Error(
      `Firebase não configurado. Defina: ${missing.join(', ')}.\n` +
        'Local: copie .env.example para .env e preencha.\n' +
        'Render: Environment > Add Environment Variable (as mesmas 6 chaves).',
    )
  }

  return {
    plugins: [react(), pwaPlugin('foxy-pwa-site-v1', [
      '/logo.png', '/logo.webp', '/noise.png',
      '/fonts/anton-latin.woff2', '/fonts/outfit-latin.woff2',
      '/menu/carne-queijo.webp', '/menu/carne.webp',
      '/menu/chocolate-granulado.webp', '/menu/chocolate-mm.webp', '/menu/prestigio.webp',
    ])],
    build: {
      target: 'es2020',
      cssMinify: 'lightningcss',
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 900,
    },
    server: {
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/styles.css',
          './src/components/UfoScene.tsx',
          './src/components/three/UfoSceneStage.tsx',
        ],
      },
    },
  }
})
