/**
 * Serves the OCR evaluation page over plain HTTP (the app's own config uses a
 * self-signed certificate) and lets it read a photo folder outside the repo.
 *
 *   OCR_EVAL_DIR=/path/to/photos npx vite --config scripts/eval-ocr/vite.config.js
 *
 * Then open http://localhost:5199/scripts/eval-ocr/index.html
 */
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const photos = process.env.OCR_EVAL_DIR

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  define: { __OCR_EVAL_DIR__: JSON.stringify(photos ?? '') },
  server: {
    port: 5199,
    strictPort: true,
    fs: { allow: ['.', ...(photos ? [photos] : [])] },
  },
})
