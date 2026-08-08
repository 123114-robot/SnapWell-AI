import * as ort from 'onnxruntime-web'
import { recognizePackageText } from './ocr.js'

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
const dropZoneEl = document.getElementById('dropZone')
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const ocrButton = document.getElementById('ocrButton')
const ocrStatusEl = document.getElementById('ocrStatus')
const ocrHintEl = document.getElementById('ocrHint')
const ocrOutputEl = document.getElementById('ocrOutput')
const packageTextEl = document.getElementById('packageText')

let session
let selectedImage
let detections = []
let dragDepth = 0
let cropRect
let cropStart
let selectingCrop = false

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

fileEl.addEventListener('change', (event) => {
  const file = event.target.files[0]
  if (file) loadImageFile(file)
})

for (const eventName of ['dragenter', 'dragover']) {
  dropZoneEl.addEventListener(eventName, (event) => {
    event.preventDefault()
    if (fileEl.disabled) return
    if (eventName === 'dragenter') dragDepth += 1
    dropZoneEl.classList.add('is-dragging')
  })
}

dropZoneEl.addEventListener('dragleave', (event) => {
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dropZoneEl.classList.remove('is-dragging')
})

dropZoneEl.addEventListener('drop', (event) => {
  event.preventDefault()
  dragDepth = 0
  dropZoneEl.classList.remove('is-dragging')
  if (fileEl.disabled) return

  const file = event.dataTransfer.files[0]
  if (file) loadImageFile(file)
})

function loadImageFile(file) {
  if (!file.type.startsWith('image/')) {
    ocrHintEl.textContent = 'Please choose or drop an image file.'
    return
  }

  filenameEl.textContent = file.name
  packageTextEl.value = ''
  ocrOutputEl.hidden = true
  ocrStatusEl.textContent = ''
  ocrHintEl.textContent = 'Loading image…'
  detections = []
  cropRect = undefined
  ocrButton.disabled = true

  const img = new Image()
  const imageUrl = URL.createObjectURL(file)
  img.onload = () => {
    URL.revokeObjectURL(imageUrl)
    selectedImage = img
    renderCanvas()
    ocrHintEl.textContent = 'Drag a box around any package text, then read the selected text locally.'
    runDetect(img)
  }
  img.src = imageUrl
}

ocrButton.addEventListener('click', async () => {
  if (!selectedImage || !cropRect) return

  ocrButton.disabled = true
  ocrStatusEl.textContent = 'Preparing local OCR…'

  try {
    const result = await recognizePackageText(createCropCanvas(), (message) => {
      const progress = Number.isFinite(message.progress)
        ? ` ${Math.round(message.progress * 100)}%`
        : ''
      ocrStatusEl.textContent = `OCR: ${message.status}${progress}`
    })

    if (result.text) {
      packageTextEl.value = packageTextEl.value
        ? `${packageTextEl.value}\n\n---\n\n${result.text}`
        : result.text
      ocrOutputEl.hidden = false
    }
    const confidence = Number.isFinite(result.confidence)
      ? `confidence: ${result.confidence.toFixed(1)}%`
      : 'confidence not reported'
    ocrStatusEl.textContent =
      `OCR completed locally - ${result.text ? confidence : 'no text detected'}, ` +
      `total time: ${result.metrics.totalMs.toFixed(0)} ms`
    ocrHintEl.textContent = 'Text added. Drag another box to add more package text, or edit the result below.'
  } catch (error) {
    ocrStatusEl.textContent = `OCR failed: ${error.message}`
    console.error(error)
  } finally {
    ocrButton.disabled = !cropRect
  }
})

function renderCanvas() {
  if (!selectedImage) return

  canvas.width = selectedImage.width
  canvas.height = selectedImage.height
  ctx.drawImage(selectedImage, 0, 0)

  ctx.lineWidth = Math.max(2, selectedImage.width / 250)
  ctx.font = Math.max(14, selectedImage.width / 40) + 'px sans-serif'
  for (const detection of detections) drawDetection(detection)
  if (cropRect) drawCropOverlay(cropRect)
}

function drawCropOverlay(rectangle) {
  ctx.fillStyle = 'rgba(0, 90, 180, 0.28)'
  ctx.fillRect(0, 0, canvas.width, rectangle.y)
  ctx.fillRect(0, rectangle.y + rectangle.height, canvas.width, canvas.height - (rectangle.y + rectangle.height))
  ctx.fillRect(0, rectangle.y, rectangle.x, rectangle.height)
  ctx.fillRect(rectangle.x + rectangle.width, rectangle.y, canvas.width - (rectangle.x + rectangle.width), rectangle.height)
  ctx.strokeStyle = '#0066cc'
  ctx.lineWidth = Math.max(3, selectedImage.width / 180)
  ctx.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
}

function getCanvasPoint(event) {
  const bounds = canvas.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)),
  }
}

function rectangleFromPoints(start, end) {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return { x, y, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
}

function createCropCanvas() {
  const crop = document.createElement('canvas')
  crop.width = Math.round(cropRect.width)
  crop.height = Math.round(cropRect.height)
  crop.getContext('2d').drawImage(
    selectedImage,
    cropRect.x, cropRect.y, cropRect.width, cropRect.height,
    0, 0, crop.width, crop.height,
  )
  return crop
}

canvas.addEventListener('pointerdown', (event) => {
  if (!selectedImage) return
  event.preventDefault()
  cropStart = getCanvasPoint(event)
  cropRect = { x: cropStart.x, y: cropStart.y, width: 0, height: 0 }
  selectingCrop = true
  ocrButton.disabled = true
  canvas.setPointerCapture(event.pointerId)
  renderCanvas()
})

canvas.addEventListener('pointermove', (event) => {
  if (!selectingCrop) return
  cropRect = rectangleFromPoints(cropStart, getCanvasPoint(event))
  renderCanvas()
})

canvas.addEventListener('pointerup', (event) => {
  if (!selectingCrop) return
  selectingCrop = false
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  if (cropRect.width < 20 || cropRect.height < 20) {
    cropRect = undefined
    ocrButton.disabled = true
    ocrHintEl.textContent = 'Please drag a larger box around the text you want to read.'
  } else {
    ocrButton.disabled = false
    ocrHintEl.textContent = 'Area selected. Read the selected text locally, or drag again to change it.'
  }
  renderCanvas()
})

function drawDetection(detection) {
  ctx.strokeStyle = '#00c853'
  ctx.strokeRect(detection.x, detection.y, detection.width, detection.height)
  ctx.fillStyle = '#00c853'
  const textWidth = ctx.measureText(detection.label).width
  ctx.fillRect(detection.x, Math.max(0, detection.y - 22), textWidth + 8, 22)
  ctx.fillStyle = '#fff'
  ctx.fillText(detection.label, detection.x + 4, Math.max(16, detection.y - 5))
}

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

    detections = boxes.map((b) => {
      const x = (b.x1 - padX) / scale, y = (b.y1 - padY) / scale
      const w = (b.x2 - b.x1) / scale, h = (b.y2 - b.y1) / scale
      const label = NAMES[b.cls] + ' ' + (b.score * 100).toFixed(0) + '%'
      return { x, y, width: w, height: h, label }
    })
    renderCanvas()

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
