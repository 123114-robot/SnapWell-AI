import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      'onnxruntime-web': fileURLToPath(
        new URL('./node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs', import.meta.url)
      )
    }
  },
  server: { host: true }
})
