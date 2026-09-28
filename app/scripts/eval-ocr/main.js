/**
 * OCR and barcode evaluation over a folder of package photos.
 *
 * Every photo in <dir>/manifest.json is run through the app's own modules
 * under three OCR configurations, and through the barcode decoder:
 *
 *   pass1     locateTextRegions only: one sparse read of a downscaled copy
 *   twoPass   the automatic scan the app runs (ScanPackage.jsx runAutoScan)
 *   fullImage recognizePackageText on the whole photo, the Spike B pipeline
 *             without a crop, as a baseline
 *
 * Results collect in window.__ocrEval.results. Nothing is sent anywhere.
 */

import { cropRegion, locateTextRegions, recognizePackageText } from '../../src/ai/ocr.js'
import { buildKeywordIndex, matchIngredients } from '../../src/ai/ingredientMatch.js'
import { normaliseBarcode } from '../../src/product/productData.js'

/* global __OCR_EVAL_DIR__ */
const DIR = __OCR_EVAL_DIR__
const fsUrl = (file) => `/@fs${DIR}/${file.split('/').map(encodeURIComponent).join('/')}`

// Mirrors the constants of runAutoScan in src/screens/ScanPackage.jsx
const PASS2_REGIONS = 2
const REGION_PAD = 8
const PASS1_TRUSTED_SCORE = 0.95
const DETAIL_HEADING = /nutrition\s+information|ingredients?|contains?|may\s+contain/i

// Mirrors createRetailReader and decodePhotoWithConsensus in src/screens/ScanBarcode.jsx
const RETAIL_FORMAT_NAMES = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E']

const status = document.getElementById('status')
const log = document.getElementById('log')
const say = (line) => { log.textContent = `${line}\n${log.textContent}`.slice(0, 20000) }

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`could not load ${url}`))
    image.src = url
  })
}

const summarise = (matches) => matches.map((m) => ({
  label: m.label, score: m.score, genus: m.genus ?? null, keyword: m.matchedKeyword,
}))

/** The app's automatic scan, step for step. */
async function twoPassScan(image, index) {
  const started = performance.now()
  const located = await locateTextRegions(image)
  const pass1Ms = performance.now() - started
  let combined = located.text
  const pass1Matches = matchIngredients(combined, index)
  const pass1 = {
    ms: pass1Ms,
    text: located.text,
    regions: located.regions.length,
    blocksFound: located.metrics.blocksFound,
    matches: summarise(pass1Matches),
  }

  let usedRegionPass = false
  let usedDetailPass = false
  const pass1IsTrusted = pass1Matches.some((m) => m.score >= PASS1_TRUSTED_SCORE)
  if (!pass1IsTrusted && located.regions.length) {
    usedRegionPass = true
    const parts = []
    for (const region of located.regions.slice(0, PASS2_REGIONS)) {
      const padded = {
        x: Math.max(0, region.x - REGION_PAD),
        y: Math.max(0, region.y - REGION_PAD),
        width: region.width + REGION_PAD * 2,
        height: region.height + REGION_PAD * 2,
      }
      const read = await recognizePackageText(cropRegion(image, padded))
      if (read.text) parts.push(read.text)
    }
    if (parts.length) combined = [combined, ...parts].filter(Boolean).join('\n')
  }
  if (DETAIL_HEADING.test(combined)) {
    usedDetailPass = true
    const detailed = await recognizePackageText(image)
    if (detailed.text) combined = [combined, detailed.text].filter(Boolean).join('\n')
  }

  return {
    pass1,
    twoPass: {
      ms: performance.now() - started,
      usedRegionPass,
      usedDetailPass,
      text: combined,
      matches: summarise(matchIngredients(combined, index)),
    },
  }
}

async function fullImageScan(image, index) {
  const started = performance.now()
  const read = await recognizePackageText(image)
  return {
    ms: performance.now() - started,
    confidence: read.confidence,
    text: read.text,
    matches: summarise(matchIngredients(read.text, index)),
  }
}

function rotatedCanvas(image, quarterTurns) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const scale = Math.min(1, 2000 / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const sideways = quarterTurns % 2 === 1
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? height : width
  canvas.height = sideways ? width : height
  const context = canvas.getContext('2d')
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(quarterTurns * Math.PI / 2)
  context.drawImage(image, -width / 2, -height / 2, width, height)
  return canvas
}

async function barcodeScan(image, reader) {
  const started = performance.now()
  const readings = []
  for (const quarterTurns of [1, 3, 0, 2]) {
    try {
      const result = await reader.decodeFromCanvas(rotatedCanvas(image, quarterTurns))
      readings.push({ raw: result.getText(), valid: normaliseBarcode(result.getText()) })
    } catch {
      readings.push(null)
    }
  }
  const counts = new Map()
  readings.filter((r) => r?.valid).forEach((r) => counts.set(r.valid, (counts.get(r.valid) || 0) + 1))
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  let accepted = null
  if (ranked[0]?.[1] >= 2) accepted = ranked[0][0]
  else if (ranked.length === 1) accepted = ranked[0][0]
  return {
    ms: performance.now() - started,
    readings,
    accepted,
    conflicting: ranked.length > 1 && !(ranked[0][1] >= 2),
  }
}

async function main() {
  const manifest = await (await fetch(fsUrl('manifest.json'))).json()
  const index = buildKeywordIndex(await (await fetch('/data/food_data/ingredient-map-v1.json')).json())
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, RETAIL_FORMAT_NAMES.map((name) => BarcodeFormat[name]))
  hints.set(DecodeHintType.TRY_HARDER, true)
  const reader = new BrowserMultiFormatReader(hints)

  const params = new URLSearchParams(location.search)
  const only = params.get('channel')
  const limit = Number(params.get('limit')) || Infinity
  const items = manifest.items.filter((item) => !only || item.channel === only).slice(0, limit)
  const state = { total: items.length, done: 0, results: [], finished: false, userAgent: navigator.userAgent }
  window.__ocrEval = state

  // Warm the Tesseract worker so the first photo does not carry the cold start
  const warm = performance.now()
  await recognizePackageText(document.createElement('canvas'))
  state.coldStartMs = performance.now() - warm

  for (const item of items) {
    status.textContent = `${state.done + 1} / ${state.total}: ${item.file}`
    const record = { ...item }
    try {
      const image = await loadImage(fsUrl(item.file))
      record.width = image.naturalWidth
      record.height = image.naturalHeight
      Object.assign(record, await twoPassScan(image, index))
      record.fullImage = await fullImageScan(image, index)
      record.barcode = await barcodeScan(image, reader)
    } catch (error) {
      record.error = String(error?.message ?? error)
    }
    state.results.push(record)
    state.done += 1
    const top = record.twoPass?.matches?.[0]?.label ?? '-'
    say(`${item.file}  expected ${item.expected}  twoPass top ${top}  ${Math.round(record.twoPass?.ms ?? 0)} ms`)
  }
  state.finished = true
  status.textContent = `Finished ${state.done} photos`
}

main().catch((error) => {
  status.textContent = `Failed: ${error.message}`
  console.error(error)
})
