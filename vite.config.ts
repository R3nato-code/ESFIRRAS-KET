import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
})
