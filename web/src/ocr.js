import { createWorker, OEM, PSM } from 'tesseract.js'

let workerPromise
let progressListener = () => {}

const OCR_ASSET_ROOT = '/tesseract'

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

function createCanvas(image) {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const scale = Math.min(2, 1600 / Math.max(width, height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
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
    if (coldStart) {
      await worker.setParameters({
        // Each user crop is intended to be one text block, not a whole document.
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      })
    }
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

export async function recognizePackageText(image, onProgress = () => {}) {
  const totalStart = performance.now()
  const workerInfo = await getWorker(onProgress)
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
      sourceWidth: image.naturalWidth || image.width,
      sourceHeight: image.naturalHeight || image.height,
      processedWidth: preparedImages.colourContrastImage.width,
      processedHeight: preparedImages.colourContrastImage.height,
    },
  }
}
