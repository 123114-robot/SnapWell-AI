import * as ort from 'onnxruntime-web'

ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.wasm' }
ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false

const MODEL = '/models/yolov8n.onnx'
const SIZE = 640
const CONF_THRES = 0.25
const IOU_THRES = 0.45

const NAMES = ['person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush']

const statusEl = document.getElementById('status')
const pickEl = document.getElementById('pick')
const filenameEl = document.getElementById('filename')
const statsEl = document.getElementById('stats')
const fileEl = document.getElementById('file')
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

let session

async function init() {
  try {
    const t0 = performance.now()
    session = await ort.InferenceSession.create(MODEL, { executionProviders: ['wasm'] })
    const t1 = performance.now()
    statusEl.textContent = 'Model loaded in ' + (t1 - t0).toFixed(0) + ' ms. Pick a photo to run detection.'
    fileEl.disabled = false
    pickEl.setAttribute('aria-disabled', 'false')
  } catch (err) {
    statusEl.style.color = 'red'
    statusEl.textContent = 'Model failed to load: ' + err.message
    console.error(err)
  }
}

fileEl.addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) return
  filenameEl.textContent = file.name
  const img = new Image()
  img.onload = () => runDetect(img)
  img.src = URL.createObjectURL(file)
})

function runDetect(img) {
  const tPre0 = performance.now()
  const scale = Math.min(SIZE / img.width, SIZE / img.height)
  const nw = Math.round(img.width * scale)
  const nh = Math.round(img.height * scale)
  const padX = (SIZE - nw) / 2
  const padY = (SIZE - nh) / 2

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
  const tPre1 = performance.now()

  const tensor = new ort.Tensor('float32', input, [1, 3, SIZE, SIZE])
  const tInf0 = performance.now()
  session.run({ images: tensor }).then((out) => {
    const tInf1 = performance.now()
    const tPost0 = performance.now()
    const raw = out.output0.data
    const N = 8400
    let boxes = []
    for (let i = 0; i < N; i++) {
      let best = 0, cls = -1
      for (let c = 0; c < 80; c++) {
        const s = raw[(4 + c) * N + i]
        if (s > best) { best = s; cls = c }
      }
      if (best < CONF_THRES) continue
      const cx = raw[i], cy = raw[N + i], w = raw[2 * N + i], h = raw[3 * N + i]
      boxes.push({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2, score: best, cls })
    }
    boxes = nms(boxes, IOU_THRES)
    const tPost1 = performance.now()

    canvas.width = img.width; canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    ctx.lineWidth = Math.max(2, img.width / 250)
    ctx.font = Math.max(14, img.width / 40) + 'px sans-serif'
    for (const b of boxes) {
      const x = (b.x1 - padX) / scale, y = (b.y1 - padY) / scale
      const w = (b.x2 - b.x1) / scale, h = (b.y2 - b.y1) / scale
      ctx.strokeStyle = '#00c853'
      ctx.strokeRect(x, y, w, h)
      const label = NAMES[b.cls] + ' ' + (b.score * 100).toFixed(0) + '%'
      ctx.fillStyle = '#00c853'
      const tw = ctx.measureText(label).width
      ctx.fillRect(x, Math.max(0, y - 22), tw + 8, 22)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x + 4, Math.max(16, y - 5))
    }

    statsEl.textContent =
      'Preprocess:  ' + (tPre1 - tPre0).toFixed(0) + ' ms\n' +
      'Inference:   ' + (tInf1 - tInf0).toFixed(0) + ' ms\n' +
      'Postprocess: ' + (tPost1 - tPost0).toFixed(0) + ' ms\n' +
      'Total:       ' + (tPost1 - tPre0).toFixed(0) + ' ms\n' +
      'Detected ' + boxes.length + ' object(s)'
  }).catch((err) => {
    statsEl.textContent = 'Inference failed: ' + err.message
    console.error(err)
  })
}

function nms(boxes, iouThres) {
  boxes.sort((a, b) => b.score - a.score)
  const keep = []
  while (boxes.length) {
    const a = boxes.shift()
    keep.push(a)
    boxes = boxes.filter((b) => iou(a, b) < iouThres)
  }
  return keep
}

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1)
  const x2 = Math.min(a.x2, b.x2), y2 = Math.min(a.y2, b.y2)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1)
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1)
  return inter / (areaA + areaB - inter + 1e-6)
}

init()
