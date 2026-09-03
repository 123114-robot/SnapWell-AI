import { createWorker, OEM, PSM } from 'tesseract.js'

/**
 * On-device package-label OCR, ported from Spike B (web/src/ocr.js).
 *
 * - One Tesseract worker is created on the first request and reused for the
 *   rest of the browser session (cold start is reported separately in metrics).
 * - The input is resized to at most a 1600 px longest edge, then recognised
 *   twice: once as a colour-aware contrast-enhanced image and once as an Otsu
 *   binary image. The higher-confidence result wins.
 * - Nothing leaves the browser: worker, core and language data are served from
 *   this app's /tesseract/ assets.
 */

const OCR_ASSET_ROOT = '/tesseract'
const MAX_EDGE = 1600
const MAX_UPSCALE = 2

let workerPromise
let progressListener = () => {}

function otsuThreshold(histogram, pixelCount) {
  let totalIntensity = 0
  for (let value = 0; value < histogram.length; value += 1) {
    totalIntensity += value * histogram[value]
  }

  let backgroundCount = 0
  let backgroundIntensity = 0
  let bestVariance = -1
  let threshold = 128

  for (let value = 0; value < histogram.length; value += 1) {
    backgroundCount += histogram[value]
    if (backgroundCount === 0) continue

    const foregroundCount = pixelCount - backgroundCount
    if (foregroundCount === 0) break

    backgroundIntensity += value * histogram[value]
    const backgroundMean = backgroundIntensity / backgroundCount
    const foregroundMean = (totalIntensity - backgroundIntensity) / foregroundCount
    const variance = backgroundCount * foregroundCount * (backgroundMean - foregroundMean) ** 2

    if (variance > bestVariance) {
      bestVariance = variance
      threshold = value
    }
  }

  return { threshold, variance: bestVariance }
}

function sourceSize(image) {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  }
}

/**
 * Same sizing rule as Spike B: scale towards a 1600 px longest edge, but never
 * upscale a small crop by more than 2x.
 */
function createCanvas(image) {
  const { width, height } = sourceSize(image)
  const scale = Math.min(MAX_UPSCALE, MAX_EDGE / Math.max(width, height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  return canvas
}

function prepareColourContrastImage(image) {
  const canvas = createCanvas(image)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  const histograms = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  const pixelCount = canvas.width * canvas.height

  for (let index = 0; index < data.length; index += 4) {
    histograms[0][data[index]] += 1
    histograms[1][data[index + 1]] += 1
    histograms[2][data[index + 2]] += 1
  }

  // Pick the colour channel that separates text from background best.
  const channelInfo = histograms.map((histogram) => otsuThreshold(histogram, pixelCount))
  const channel = channelInfo.reduce(
    (best, info, index) => (info.variance > channelInfo[best].variance ? index : best),
    0,
  )
  const { threshold } = channelInfo[channel]
  let lightPixels = 0
  for (let index = channel; index < data.length; index += 4) {
    if (data[index] > threshold) lightPixels += 1
  }
  const invert = lightPixels < pixelCount / 2

  for (let index = 0; index < data.length; index += 4) {
    const channelValue = data[index + channel]
    const contrasted = Math.max(0, Math.min(255, Math.round((channelValue - threshold) * 1.8 + 128)))
    const value = invert ? 255 - contrasted : contrasted
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
  }
  context.putImageData(imageData, 0, 0)
  return canvas
}

function prepareBinaryImage(image) {
  const canvas = createCanvas(image)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  const histogram = new Uint32Array(256)
  const pixelCount = canvas.width * canvas.height

  for (let index = 0; index < data.length; index += 4) {
    histogram[data[index]] += 1
  }

  const { threshold } = otsuThreshold(histogram, pixelCount)
  let lightPixels = 0
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] > threshold) lightPixels += 1
  }
  const invert = lightPixels < pixelCount / 2

  for (let index = 0; index < data.length; index += 4) {
    const isLight = data[index] > threshold
    const value = (invert ? !isLight : isLight) ? 255 : 0
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
  }
  context.putImageData(imageData, 0, 0)

  return canvas
}

function prepareImagesForOcr(image) {
  const colourContrastImage = prepareColourContrastImage(image)
  return {
    colourContrastImage,
    binaryImage: prepareBinaryImage(colourContrastImage),
  }
}

async function getWorker(onProgress) {
  progressListener = onProgress
  const coldStart = !workerPromise
  const start = performance.now()

  if (coldStart) {
    workerPromise = createWorker('eng', OEM.LSTM_ONLY, {
      logger: (message) => progressListener(message),
      workerPath: `${OCR_ASSET_ROOT}/worker.min.js`,
      corePath: `${OCR_ASSET_ROOT}/core`,
      langPath: `${OCR_ASSET_ROOT}/lang`,
    })
  }

  try {
    const worker = await workerPromise
    return {
      worker,
      coldStart,
      initializationMs: coldStart ? performance.now() - start : 0,
    }
  } catch (error) {
    workerPromise = undefined
    throw error
  }
}

/**
 * Cut a region { x, y, width, height } (source-image pixels) out of an image
 * into a new canvas. Returns the image itself when no region is given.
 */
export function cropRegion(image, region) {
  if (!region) return image
  const crop = document.createElement('canvas')
  crop.width = Math.max(1, Math.round(region.width))
  crop.height = Math.max(1, Math.round(region.height))
  crop.getContext('2d').drawImage(
    image,
    region.x, region.y, region.width, region.height,
    0, 0, crop.width, crop.height,
  )
  return crop
}

/**
 * Recognise package text in an image or canvas.
 * onProgress receives Tesseract logger messages ({ status, progress }).
 */
export async function recognizePackageText(image, onProgress = () => {}) {
  const totalStart = performance.now()
  const workerInfo = await getWorker(onProgress)
  // The worker is shared with locateTextRegions, which uses a different page
  // segmentation mode, so set ours every time rather than once at cold start.
  await workerInfo.worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
  const preprocessStart = performance.now()
  const preparedImages = prepareImagesForOcr(image)
  const preprocessMs = performance.now() - preprocessStart
  const colourRecognitionStart = performance.now()
  const colourResult = await workerInfo.worker.recognize(preparedImages.colourContrastImage)
  const colourRecognitionMs = performance.now() - colourRecognitionStart
  const binaryRecognitionStart = performance.now()
  const binaryResult = await workerInfo.worker.recognize(preparedImages.binaryImage)
  const binaryRecognitionMs = performance.now() - binaryRecognitionStart
  const data = binaryResult.data.confidence > colourResult.data.confidence
    ? binaryResult.data
    : colourResult.data
  const recognitionMs = colourRecognitionMs + binaryRecognitionMs
  const totalMs = performance.now() - totalStart
  const { width, height } = sourceSize(image)

  return {
    text: data.text.trim(),
    confidence: data.confidence,
    durationMs: totalMs,
    metrics: {
      coldStart: workerInfo.coldStart,
      initializationMs: workerInfo.initializationMs,
      preprocessMs,
      recognitionMs,
      totalMs,
      sourceWidth: width,
      sourceHeight: height,
      processedWidth: preparedImages.colourContrastImage.width,
      processedHeight: preparedImages.colourContrastImage.height,
    },
  }
}

/**
 * Tesseract often splits one product name across blocks, one per line, so
 * "GARDEN" and "PEAS" arrive separately and only the taller one survives the
 * ranking. Rejoin blocks that sit directly above one another and overlap
 * horizontally, which is what stacked lines of a single title look like.
 */
function mergeStackedRegions(regions) {
  const out = regions.map((r) => ({ ...r }))
  let mergedSomething = true

  while (mergedSomething) {
    mergedSomething = false
    outer:
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const a = out[i]
        const b = out[j]
        const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        if (overlap <= 0 || overlap / Math.min(a.width, b.width) < 0.3) continue

        const gap = Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height)
        if (gap > 1.2 * Math.max(a.textHeight, b.textHeight)) continue

        const x = Math.min(a.x, b.x)
        const y = Math.min(a.y, b.y)
        const top = a.y < b.y ? a : b
        const bottom = a.y < b.y ? b : a
        out[i] = {
          x,
          y,
          width: Math.max(a.x + a.width, b.x + b.width) - x,
          height: Math.max(a.y + a.height, b.y + b.height) - y,
          text: `${top.text}\n${bottom.text}`,
          confidence: Math.max(a.confidence, b.confidence),
          textHeight: Math.max(a.textHeight, b.textHeight),
        }
        out.splice(j, 1)
        mergedSomething = true
        break outer
      }
    }
  }

  return out
}

/**
 * Pass 1 of the two-pass pipeline: find the text regions in a photo.
 *
 * Runs one cheap recognition on a downscaled copy with no preprocessing. The
 * point is NOT to read the label correctly — small print will be illegible at
 * this size — it is only to discover WHERE the text is, which is a much easier
 * problem. Each returned region is then re-read at full resolution by
 * `recognizePackageText`, which is the path Spike B validated.
 *
 * Global Otsu thresholding is deliberately skipped here: on a whole package
 * photo a single threshold is wrong for most of the frame.
 *
 * Regions come back in ORIGINAL image pixels, ranked with the largest, most
 * confident text first — on a package that is normally the product name.
 */
export async function locateTextRegions(image, options = {}) {
  const {
    maxEdge = 900,
    minConfidence = 45,
    minTextHeight = 12,
    limit = 4,
    onProgress = () => {},
  } = options

  const t0 = performance.now()
  const { width, height } = sourceSize(image)
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)

  const workerInfo = await getWorker(onProgress)
  await workerInfo.worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
  const { data } = await workerInfo.worker.recognize(canvas, {}, { blocks: true, text: true })

  const candidates = []
  for (const block of data.blocks || []) {
    const text = (block.text || '').trim()
    if (!text) continue

    let textHeight = 0
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        textHeight = Math.max(textHeight, (line.bbox.y1 - line.bbox.y0) / scale)
      }
    }
    if (textHeight < minTextHeight) continue

    candidates.push({
      x: block.bbox.x0 / scale,
      y: block.bbox.y0 / scale,
      width: (block.bbox.x1 - block.bbox.x0) / scale,
      height: (block.bbox.y1 - block.bbox.y0) / scale,
      text,
      confidence: block.confidence,
      textHeight,
    })
  }

  // Merge BEFORE filtering on confidence. A line that pass 1 misread scores
  // badly, but it is often part of a title whose other line read cleanly
  // ("GARDEN" at 96, "PEAS" misread as "TEE"). Dropping it first would leave a
  // crop that cuts the product name in half, and pass 2 could never recover it.
  const regions = mergeStackedRegions(candidates)
    .filter((r) => r.confidence >= minConfidence)
  regions.sort((a, b) => b.textHeight - a.textHeight)

  return {
    regions: regions.slice(0, limit),
    text: (data.text || '').trim(),
    metrics: {
      coldStart: workerInfo.coldStart,
      initializationMs: workerInfo.initializationMs,
      totalMs: performance.now() - t0,
      scannedWidth: canvas.width,
      scannedHeight: canvas.height,
      blocksFound: (data.blocks || []).length,
      blocksKept: regions.length,
    },
  }
}

/** Convenience wrapper: crop then recognise. */
export function readText(image, region, onProgress) {
  return recognizePackageText(cropRegion(image, region), onProgress)
}

/** Release the shared worker (e.g. for tests). Safe to call when none exists. */
export async function disposeOcrWorker() {
  if (!workerPromise) return
  const pending = workerPromise
  workerPromise = undefined
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    // worker never finished initialising; nothing to release
  }
}
