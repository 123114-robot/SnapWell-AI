import { createWorker } from 'tesseract.js'

/**
 * A fresh worker is created per call and terminated afterwards. Reusing one
 * worker across calls proved unreliable (the second recognise() would hang),
 * so we trade a few hundred ms of startup for predictable behaviour.
 */
function makeWorker() {
  return createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    langPath: '/tesseract/lang',
    corePath: '/tesseract/core'
  })
}

/**
 * Recognise text in a region of an image.
 * region: { x, y, w, h } in original-image pixels; omit to read the whole image.
 */
export async function readText(img, region) {
  const t0 = performance.now()
  const src = region || { x: 0, y: 0, w: img.width, h: img.height }

  // Crop and upscale the region for better OCR accuracy.
  const scale = Math.min(3, Math.max(1, 800 / Math.max(src.w, src.h)))
  const c = document.createElement('canvas')
  c.width = Math.round(src.w * scale)
  c.height = Math.round(src.h * scale)
  const ctx = c.getContext('2d')
  ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, c.width, c.height)

  const worker = await makeWorker()
  try {
    const { data } = await worker.recognize(c)
    return {
      text: data.text.trim(),
      confidence: data.confidence,
      elapsed: performance.now() - t0
    }
  } finally {
    await worker.terminate()
  }
}
