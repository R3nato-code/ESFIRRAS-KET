import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/* O painel é um app independente, mas reaproveita o .env da raiz no
   desenvolvimento local. Em produção (Render), as variáveis são injetadas
   no build do serviço do admin. */
const envDir = fileURLToPath(new URL('..', import.meta.url))

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_')
  const missing = REQUIRED_ENV.filter(
    (key) => !(process.env[key] ?? env[key])?.trim(),
  )

  if (missing.length > 0) {
    throw new Error(
      `Firebase não configurado para o painel. Defina: ${missing.join(', ')}.\n` +
        'Local: o painel lê o .env da raiz do repositório.\n' +
        'Render: cadastre as 6 chaves no serviço do admin.',
    )
  }

  return {
    plugins: [react()],
    envDir,
    build: {
      target: 'es2020',
      cssMinify: 'lightningcss',
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 900,
    },
    server: {
      port: 5174,
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/AdminApp.tsx',
          './src/styles/base.css',
        ],
      },
    },
  }
})
