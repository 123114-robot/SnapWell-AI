import * as ort from 'onnxruntime-web'
import { NAMES } from './labels.js'

ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.wasm' }
ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false

const SIZE = 640
const CONF_THRES = 0.25
const IOU_THRES = 0.45
const NUM_CLASSES = NAMES.length

export async function createSession(modelUrl, onProgress) {
  const res = await fetch(modelUrl)
  const total = Number(res.headers.get('Content-Length')) || 0
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (onProgress && total) onProgress(received / total)
  }
  const buf = new Uint8Array(received)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.length }
  return ort.InferenceSession.create(buf, { executionProviders: ['wasm'] })
}

export async function detect(session, img) {
  const iw = img.width || img.naturalWidth
  const ih = img.height || img.naturalHeight
  const t0 = performance.now()

  const scale = Math.min(SIZE / iw, SIZE / ih)
  const nw = Math.round(iw * scale), nh = Math.round(ih * scale)
  const padX = (SIZE - nw) / 2, padY = (SIZE - nh) / 2
  const tmp = document.createElement('canvas')
  tmp.width = SIZE; tmp.height = SIZE
  const tctx = tmp.getContext('2d')
  tctx.fillStyle = '#727272'
  tctx.fillRect(0, 0, SIZE, SIZE)
  tctx.drawImage(img, padX, padY, nw, nh)
  const data = tctx.getImageData(0, 0, SIZE, SIZE).data
  const input = new Float32Array(3 * SIZE * SIZE)
  for (let i = 0; i < SIZE * SIZE; i++) {
    input[i] = data[i * 4] / 255
    input[SIZE * SIZE + i] = data[i * 4 + 1] / 255
    input[2 * SIZE * SIZE + i] = data[i * 4 + 2] / 255
  }
  const t1 = performance.now()

  const out = await session.run({ images: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
  const t2 = performance.now()

  const raw = out.output0.data
  const N = 8400
  let boxes = []
  for (let i = 0; i < N; i++) {
    let best = 0, cls = -1
    for (let c = 0; c < NUM_CLASSES; c++) {
      const s = raw[(4 + c) * N + i]
      if (s > best) { best = s; cls = c }
    }
    if (best < CONF_THRES) continue
    const cx = raw[i], cy = raw[N + i], w = raw[2 * N + i], h = raw[3 * N + i]
    boxes.push({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2, score: best, cls })
  }
  boxes = nms(boxes, IOU_THRES)
  const t3 = performance.now()

  return {
    detections: boxes.map((b, idx) => ({
      id: idx,
      label: NAMES[b.cls],
      confidence: b.score,
      bbox: {
        x: (b.x1 - padX) / scale,
        y: (b.y1 - padY) / scale,
        w: (b.x2 - b.x1) / scale,
        h: (b.y2 - b.y1) / scale
      }
    })),
    timing: { preprocess: t1 - t0, inference: t2 - t1, postprocess: t3 - t2, total: t3 - t0 }
  }
}

function nms(boxes, thres) {
  boxes.sort((a, b) => b.score - a.score)
  const keep = []
  while (boxes.length) {
    const a = boxes.shift()
    keep.push(a)
    boxes = boxes.filter((b) => iou(a, b) < thres)
  }
  return keep
}

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1)
  const x2 = Math.min(a.x2, b.x2), y2 = Math.min(a.y2, b.y2)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter + 1e-6)
}

/**
 * Run one throwaway inference on a blank tensor so the wasm module is
 * JIT-compiled before the user's first real detection. On low-end Android
 * this moves ~1.6 s of compilation cost out of the user-facing path
 * (see docs/spike-a-results.en.md, section 4).
 */
export async function warmUp(session) {
  const blank = new Float32Array(3 * SIZE * SIZE)
  const t0 = performance.now()
  await session.run({ images: new ort.Tensor('float32', blank, [1, 3, SIZE, SIZE]) })
  return performance.now() - t0
}
