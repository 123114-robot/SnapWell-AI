import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { cropRegion, locateTextRegions, recognizePackageText } from '../ai/ocr.js'
import { allLabels, loadIngredientIndex, matchIngredients } from '../ai/ingredientMatch.js'
import { assessProductSafety, parseAllergenStatements, parseNutritionPanel } from '../product/productData.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

// Display canvas is capped so a 12 MP phone photo does not become a 48 MB bitmap.
const DISPLAY_MAX_EDGE = 1600
// Crops smaller than this (in source pixels) are rejected as accidental taps.
const MIN_CROP_EDGE = 20
// How many located regions are re-read at full resolution when pass 1 alone
// produced no match. Each costs roughly a second, so keep this low.
const PASS2_REGIONS = 2
// Padding around a located region before the high-resolution re-read.
const REGION_PAD = 8
/**
 * Pass 1 may skip the expensive re-read only when it found strong evidence of
 * the product's identity — in practice an exact multi-word keyword such as
 * "beef mince". A lone common noun does not qualify: a jar of bolognese lists
 * "tomato" in its description, and letting that end the scan would stop the
 * product name from ever being read properly.
 */
const PASS1_TRUSTED_SCORE = 0.95
const DETAIL_HEADING = /nutrition\s+information|ingredients?|contains?|may\s+contain/i

const STATUS = {
  conflict: { icon: '!', label: 'Conflict', fg: '#A62F18', bg: '#F8E3DC' },
  trace: { icon: '△', label: 'May contain', fg: '#7A5200', bg: '#FBEECB' },
  clear: { icon: '✓', label: 'Not found', fg: '#1B4332', bg: '#E7EFE9' },
  unknown: { icon: '?', label: 'Unknown', fg: '#5E6E64', bg: '#EEEAE1' },
}

const titleCase = (value) => String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

let idCounter = 0
const nextId = () => `ocr-${Date.now()}-${idCounter += 1}`

function rectangleFromPoints(start, end) {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return { x, y, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
}

export default function ScanPackage() {
  const navigate = useNavigate()
  const location = useLocation()
  // 从检测结果页进来时返回结果页，否则回拍照页
  const backTo = location.state?.from || '/capture'
  const productReturn = location.state?.productReturn
  const { ingredients, setIngredients, preferences } = useAppState()

  const fileRef = useRef(null)
  const canvasRef = useRef(null)
  const imageRef = useRef(null)      // original HTMLImageElement
  const displayScale = useRef(1)     // display px = source px * displayScale
  const cropStart = useRef(null)
  const selecting = useRef(false)
  const runToken = useRef(0)         // cancels an in-flight scan when a new photo arrives
  const hasManualRead = useRef(false) // has the user corrected the automatic result yet
  const indexRef = useRef(null)      // keyword index, read inside the async scan

  const [hasImage, setHasImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [regions, setRegions] = useState([])
  const [scanned, setScanned] = useState(false)
  const [timing, setTiming] = useState(null)

  // 手动框选只在自动识别之后作为兜底出现
  const [manualMode, setManualMode] = useState(false)
  const [cropRect, setCropRect] = useState(null)  // display-canvas pixels
  const [cropReady, setCropReady] = useState(false)

  const [index, setIndex] = useState(null)
  const [indexError, setIndexError] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')

  // 关键词索引和图片无关，进页面就开始加载
  useEffect(() => {
    let cancelled = false
    loadIngredientIndex()
      .then((i) => {
        if (cancelled) return
        indexRef.current = i
        setIndex(i)
      })
      .catch(() => { if (!cancelled) setIndexError(true) })
    return () => { cancelled = true }
  }, [])

  // 文本或索引一变就重新匹配；用户手动改文本也会立刻反映
  const matches = useMemo(
    () => (index && text.trim() ? matchIngredients(text, index) : []),
    [text, index],
  )
  const addedLabels = useMemo(
    () => new Set(ingredients.map((i) => String(i.label).toLowerCase())),
    [ingredients],
  )
  const pickerResults = useMemo(() => {
    if (!index) return []
    const q = query.trim().toLowerCase()
    const all = allLabels(index)
    return (q ? all.filter((l) => l.displayName.toLowerCase().includes(q)) : all).slice(0, 40)
  }, [index, query])
  const packageDetails = useMemo(() => {
    const statements = parseAllergenStatements(text)
    const product = {
      allergens: statements.contains,
      traces: statements.traces,
      completeness: {
        allergens: statements.contains.length > 0,
        traces: statements.traces.length > 0,
      },
    }
    return {
      statements,
      safety: assessProductSafety(product, preferences),
      nutrition: parseNutritionPanel(text),
    }
  }, [text, preferences])

  // 画面：底图 + 自动找到的区域框 + 手动选区遮罩
  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')
    const s = displayScale.current
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    regions.forEach((r, i) => {
      ctx.strokeStyle = i === 0 ? T.wattle : 'rgba(233,168,36,0.5)'
      ctx.lineWidth = Math.max(2, canvas.width / (i === 0 ? 200 : 320))
      ctx.strokeRect(r.x * s, r.y * s, r.width * s, r.height * s)
    })

    if (!cropRect) return
    ctx.fillStyle = 'rgba(27, 67, 50, 0.45)'
    ctx.fillRect(0, 0, canvas.width, cropRect.y)
    ctx.fillRect(0, cropRect.y + cropRect.height, canvas.width, canvas.height - (cropRect.y + cropRect.height))
    ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.height)
    ctx.fillRect(cropRect.x + cropRect.width, cropRect.y, canvas.width - (cropRect.x + cropRect.width), cropRect.height)
    ctx.strokeStyle = T.wattle
    ctx.lineWidth = Math.max(3, canvas.width / 180)
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
  }, [cropRect, regions, hasImage])

  /**
   * The automatic path, run as soon as a photo is chosen.
   *
   * Pass 1 finds WHERE the text is on a downscaled copy. Its own transcription
   * is often good enough for large front-of-pack print, so it is matched first
   * and the expensive full-resolution pass is only paid for when that fails.
   */
  const runAutoScan = useCallback(async (image) => {
    runToken.current += 1
    const token = runToken.current
    const started = performance.now()
    const live = () => runToken.current === token

    setBusy(true)
    setError('')
    setRegions([])
    setStatus('Finding text on the label…')

    try {
      const located = await locateTextRegions(image, {
        onProgress: (m) => {
          if (!live()) return
          const pct = Number.isFinite(m.progress) ? ` ${Math.round(m.progress * 100)}%` : ''
          setStatus(`Finding text… ${m.status}${pct}`)
        },
      })
      if (!live()) return
      setRegions(located.regions)

      let combined = located.text
      let usedPass2 = false

      const keywordIndex = indexRef.current
      const pass1Matches = keywordIndex ? matchIngredients(combined, keywordIndex) : []
      const pass1IsTrusted = pass1Matches.some((m) => m.score >= PASS1_TRUSTED_SCORE)
      if (!pass1IsTrusted && located.regions.length) {
        // Pass 1 found nothing, or only weak evidence, so re-read the largest
        // regions at full resolution through the Spike B pipeline.
        usedPass2 = true
        const targets = located.regions.slice(0, PASS2_REGIONS)
        const parts = []
        for (const [i, region] of targets.entries()) {
          if (!live()) return
          setStatus(`Reading text (${i + 1} of ${targets.length})…`)
          const padded = {
            x: Math.max(0, region.x - REGION_PAD),
            y: Math.max(0, region.y - REGION_PAD),
            width: region.width + REGION_PAD * 2,
            height: region.height + REGION_PAD * 2,
          }
          const read = await recognizePackageText(cropRegion(image, padded))
          if (read.text) parts.push(read.text)
        }
        // Union, not replacement: pass 1 may have read words that the
        // re-read regions do not cover, and both feed the matcher.
        if (parts.length) combined = [combined, ...parts].filter(Boolean).join('\n')
      }

      // A confident product-name match should not prevent smaller structured
      // label text from being read. When a relevant heading has turned up in
      // anything read so far, re-read the whole image at full resolution.
      //
      // This pass is deliberately NOT sparse. Sparse segmentation emits one
      // table cell per line in column order, which shreds the row structure a
      // nutrition panel is: "Energy / 209kJ / 2% / 168kJ" arrives as four
      // separate lines, and the per-serving and per-100 g columns can no
      // longer be told apart. Single-block segmentation keeps a printed row on
      // one line, which is what parseNutritionPanel reads. Pass 1 already
      // covers the scattered front-of-pack text in sparse mode.
      if (DETAIL_HEADING.test(combined)) {
        usedPass2 = true
        setStatus('Reading nutrition and allergy details…')
        const detailed = await recognizePackageText(image, (message) => {
          if (!live()) return
          const pct = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : ''
          setStatus(`Reading package details… ${message.status}${pct}`)
        })
        if (!live()) return
        if (detailed.text) combined = [combined, detailed.text].filter(Boolean).join('\n')
      }

      if (!live()) return
      setText(combined)
      setScanned(true)
      setStatus('')
      setTiming({
        totalMs: performance.now() - started,
        usedPass2,
        blocksFound: located.metrics.blocksFound,
        blocksKept: located.metrics.blocksKept,
        coldStart: located.metrics.coldStart,
        initializationMs: located.metrics.initializationMs,
      })
    } catch (err) {
      console.error(err)
      if (!live()) return
      setStatus('')
      setError(`Could not read the label: ${err.message}`)
      setScanned(true)
    } finally {
      if (live()) setBusy(false)
    }
  }, [])

  function onFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      imageRef.current = img
      const longest = Math.max(img.naturalWidth, img.naturalHeight)
      displayScale.current = Math.min(1, DISPLAY_MAX_EDGE / longest)
      const canvas = canvasRef.current
      canvas.width = Math.round(img.naturalWidth * displayScale.current)
      canvas.height = Math.round(img.naturalHeight * displayScale.current)
      setHasImage(true)
      setText('')
      setRegions([])
      setScanned(false)
      setTiming(null)
      setCropRect(null)
      setCropReady(false)
      setManualMode(false)
      hasManualRead.current = false
      setPickerOpen(false)
      setQuery('')
      setError('')
      runAutoScan(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError('Could not load that image. Try another photo.')
    }
    img.src = url
  }

  function canvasPoint(event) {
    const canvas = canvasRef.current
    const bounds = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
      y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)),
    }
  }

  function onPointerDown(event) {
    if (!hasImage || busy || !manualMode) return
    event.preventDefault()
    cropStart.current = canvasPoint(event)
    selecting.current = true
    setCropReady(false)
    setCropRect({ ...cropStart.current, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event) {
    if (!selecting.current) return
    setCropRect(rectangleFromPoints(cropStart.current, canvasPoint(event)))
  }

  function onPointerUp(event) {
    if (!selecting.current) return
    selecting.current = false
    const canvas = event.currentTarget
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    const rect = rectangleFromPoints(cropStart.current, canvasPoint(event))
    const minEdge = MIN_CROP_EDGE * displayScale.current
    if (rect.width < minEdge || rect.height < minEdge) setCropRect(null)
    else { setCropRect(rect); setCropReady(true) }
  }

  /** The manual fallback: read exactly the box the user drew. */
  async function runManualOcr() {
    const image = imageRef.current
    if (!image || !cropRect || busy) return
    setBusy(true)
    setError('')
    setStatus('Reading the selected area…')

    const s = displayScale.current
    const sourceRect = {
      x: cropRect.x / s, y: cropRect.y / s,
      width: cropRect.width / s, height: cropRect.height / s,
    }

    try {
      const started = performance.now()
      const result = await recognizePackageText(cropRegion(image, sourceRect), (message) => {
        const pct = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : ''
        setStatus(`Reading… ${message.status}${pct}`)
      })
      // Selecting an area is a correction, so the first manual read replaces
      // whatever the automatic scan produced — otherwise its text keeps
      // matching ("tomato" from a description) and the user cannot override
      // it. Further reads accumulate, so several regions can still be added.
      if (result.text) {
        const replacing = !hasManualRead.current
        setText((prev) => (replacing || !prev ? result.text : `${prev}\n\n---\n\n${result.text}`))
        hasManualRead.current = true
      }
      setTiming({
        totalMs: performance.now() - started,
        manual: true,
        empty: !result.text,
      })
      setStatus('')
    } catch (err) {
      console.error(err)
      setStatus('')
      setError(`OCR failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Add a matched (or hand-picked) ingredient. `match.score` is the matcher's
   * confidence that this product is present, which is what the list shows.
   */
  function addIngredient(match) {
    const label = String(match.label).toLowerCase()
    if (addedLabels.has(label)) return
    const item = {
      id: nextId(),
      label,
      confidence: match.score ?? null,
      quantity: 1,
      unit: 'piece',
      source: 'ocr',
      bbox: null,
      ocrText: text.trim(),
      ausnutKey: match.ausnutKey ?? null,
    }
    setIngredients([...ingredients, item])
  }

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', border: 'none', borderRadius: 14, boxSizing: 'border-box',
    fontFamily: 'inherit', fontWeight: 600, fontSize: 15, padding: '14px 18px',
  }
  const sectionLabel = {
    fontWeight: 700, fontSize: 12, color: T.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  }
  const linkBtn = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 600, fontSize: 13, color: T.green,
  }
  const card = { background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: 16 }
  const nutritionRows = [
    ['Energy', 'energyKj', 'kJ'],
    ['Protein', 'proteinG', 'g'],
    ['Fat', 'fatG', 'g'],
    ['— Saturated', 'saturatedFatG', 'g'],
    ['Carbohydrate', 'carbohydrateG', 'g'],
    ['— Sugars', 'sugarsG', 'g'],
    ['Fibre', 'fibreG', 'g'],
    ['Sodium', 'sodiumMg', 'mg'],
  ].map(([name, key, unit]) => {
    const value = packageDetails.nutrition?.[key]
    if (value == null) return [name, 'Unknown']
    // "< 1.0 g" on the package must not be shown as a flat "1 g".
    const prefix = packageDetails.nutrition.lessThan?.[key] ? '< ' : ''
    return [name, `${prefix}${Number(value.toFixed(1))} ${unit}`]
  })

  const hint = !hasImage
    ? productReturn
      ? 'Photograph the Contains or May contain statement. Nothing is uploaded.'
      : 'Take a photo of the front of the package. The text is found and read for you.'
    : busy
      ? 'Reading the label on your device…'
      : manualMode
        ? 'Drag a box around the text you want to read.'
        : matches.length
          ? 'Tap an item to add it to your list.'
          : 'Nothing recognised. Pick the item yourself, or select the area to read.'

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate(backTo)} style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10,
          width: 34, height: 34, display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: T.ink, flexShrink: 0, marginTop: 3,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>
            {productReturn ? 'Scan allergen statement' : 'Read a package label'}
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{hint}</div>
        </div>
      </div>

      {!productReturn && (
        <div style={{ padding: '0 20px 8px' }}>
          <button type="button" onClick={() => navigate('/scan-package', { state: { from: backTo } })} style={{
            width: '100%', border: `1.5px solid ${T.greenLine}`, borderRadius: 12,
            padding: '10px 12px', background: '#fff', color: T.green,
            fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
          }}>Scan a barcode instead</button>
        </div>
      )}

      {/* 图片区域 */}
      <div style={{ padding: '6px 20px 0' }}>
        <div style={{
          borderRadius: 22, background: 'linear-gradient(160deg,#2a3b31,#4a5a4d)',
          position: 'relative', overflow: 'hidden',
          minHeight: hasImage ? 0 : 260, display: 'grid', placeItems: 'center',
        }}>
          {!hasImage && (
            <div style={{ color: 'rgba(255,255,255,.9)', textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 56 }}>🥫</div>
              <div style={{ fontSize: 13, marginTop: 10, opacity: 0.85 }}>
                {productReturn ? 'Contains / May contain, flat and well lit' : 'Front label, flat and well lit'}
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              display: hasImage ? 'block' : 'none', width: '100%', height: 'auto',
              touchAction: 'none', cursor: busy ? 'progress' : manualMode ? 'crosshair' : 'default',
            }}
          />
          {busy && (
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              background: 'rgba(18,38,28,0.85)', color: '#fff',
              padding: '10px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center',
            }}>
              {status || 'Working…'}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        style={{ display: 'none' }}
      />

      {/* 主操作 */}
      <div style={{ padding: '16px 20px 0', display: 'grid', gap: 10 }}>
        <button
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={busy}
          style={{
            ...btnBase,
            background: hasImage ? '#fff' : T.green,
            color: hasImage ? T.green : '#fff',
            border: hasImage ? `1.5px solid ${T.greenLine}` : 'none',
            cursor: busy ? 'default' : 'pointer',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {hasImage ? 'Choose another photo' : 'Take or choose a package photo'}
        </button>

        {manualMode && (
          <button
            onClick={runManualOcr}
            disabled={!cropReady || busy}
            style={{
              ...btnBase,
              background: cropReady && !busy ? T.green : '#9fb0a5', color: '#fff',
              cursor: cropReady && !busy ? 'pointer' : 'default',
            }}>
            Read selected text locally
          </button>
        )}

        {error && (
          <div style={{ textAlign: 'center', fontSize: 13, color: T.tomato, fontWeight: 600 }}>{error}</div>
        )}
        {timing && !busy && (
          <div style={{ textAlign: 'center', fontSize: 12, color: T.muted, fontFamily: 'monospace' }}>
            {timing.manual
              ? `selected area · ${timing.empty ? 'no text found · ' : ''}${timing.totalMs.toFixed(0)} ms`
              : `${timing.blocksKept}/${timing.blocksFound} text areas · ${timing.usedPass2 ? 'two passes' : 'one pass'} · ${timing.totalMs.toFixed(0)} ms`}
            {timing.coldStart ? ` (incl. ${timing.initializationMs.toFixed(0)} ms first-time setup)` : ''}
          </div>
        )}
      </div>

      {/* 匹配结果 */}
      {scanned && !busy && (
        <div style={{ padding: '18px 20px 0' }}>
          {productReturn && text.trim() && (
            <button type="button" onClick={() => navigate(`/product/${productReturn.barcode}`, {
              state: { from: productReturn.from || '/capture', ocrText: text.trim() },
            })} style={{
              ...btnBase, marginBottom: 14, background: T.green, color: '#fff', cursor: 'pointer',
            }}>
              Use this text in the product report
            </button>
          )}
          <div style={sectionLabel}>Add to your list</div>

          {matches.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {matches.map((m) => {
                const added = addedLabels.has(m.label)
                return (
                  <button
                    key={m.label}
                    onClick={() => addIngredient(m)}
                    disabled={added}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      textAlign: 'left', background: added ? T.greenSoft : '#fff',
                      border: `1.5px solid ${added ? T.greenLine : T.line}`,
                      borderRadius: 14, padding: '12px 14px', fontFamily: 'inherit',
                      cursor: added ? 'default' : 'pointer',
                    }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      background: added ? T.green : T.greenSoft, color: added ? '#fff' : T.green,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {added
                          ? <polyline points="20 6 9 17 4 12" />
                          : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: T.ink }}>{m.displayName}</div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                        {added
                          ? 'Already in your list'
                          : m.genus
                            ? `the label says “${m.genus}” — pick the cut`
                            : `matched “${m.matchedKeyword}”`}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: T.muted, fontFamily: 'monospace', flexShrink: 0 }}>
                      {Math.round(m.score * 100)}%
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 降级路径 */}
          {matches.length === 0 && !indexError && (
            <div style={{
              background: '#fff', border: `1px dashed ${T.line}`, borderRadius: 14,
              padding: '14px 16px', fontSize: 13, color: T.muted, lineHeight: 1.5,
            }}>
              {text.trim()
                ? 'We read the label but could not recognise a known ingredient. Pick the item yourself, or select a different area to read.'
                : 'No text was found on this photo. Try a closer, flatter shot, or select the area yourself.'}
            </div>
          )}
          {indexError && (
            <div style={{
              background: T.tomatoSoft, borderRadius: 14, padding: '12px 14px',
              fontSize: 13, color: T.tomato, fontWeight: 600,
            }}>
              Ingredient list failed to load, so matching is unavailable.
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
            <button onClick={() => setPickerOpen((v) => !v)} style={linkBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {pickerOpen ? 'Hide the ingredient list' : 'Pick the ingredient myself'}
            </button>

            {!manualMode && (
              <button onClick={() => { setManualMode(true); setRegions([]) }} style={linkBtn}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
                </svg>
                Select the area myself
              </button>
            )}
          </div>

          {pickerOpen && (
            <div style={{ marginTop: 10 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients…"
                style={{
                  boxSizing: 'border-box', width: '100%', border: `1.5px solid ${T.line}`,
                  borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit',
                  fontSize: 14, outline: 'none',
                }}
              />
              <div style={{
                marginTop: 8, maxHeight: 240, overflowY: 'auto',
                display: 'flex', flexWrap: 'wrap', gap: 6,
              }}>
                {pickerResults.map((l) => {
                  const added = addedLabels.has(l.label)
                  return (
                    <button
                      key={l.label}
                      onClick={() => addIngredient(l)}
                      disabled={added}
                      style={{
                        background: added ? T.greenSoft : '#fff',
                        border: `1.5px solid ${added ? T.greenLine : T.line}`,
                        color: added ? T.green : T.ink, borderRadius: 999,
                        padding: '7px 12px', fontFamily: 'inherit', fontWeight: 600,
                        fontSize: 13, cursor: added ? 'default' : 'pointer',
                      }}>
                      {added ? '✓ ' : ''}{l.displayName}
                    </button>
                  )
                })}
                {pickerResults.length === 0 && (
                  <span style={{ fontSize: 13, color: T.muted }}>No ingredient matches that search.</span>
                )}
              </div>
            </div>
          )}

          {!productReturn && text.trim() && (
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <section style={card}>
                <div style={sectionLabel}>Allergy check</div>
                {packageDetails.safety.length === 0 ? (
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
                    No allergy preferences are selected in Settings.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {packageDetails.safety.map((item) => {
                      const visual = STATUS[item.status]
                      return <div key={item.preference} style={{ background: visual.bg, color: visual.fg, borderRadius: 12, padding: '10px 11px', display: 'flex', gap: 9 }}>
                        <strong>{visual.icon}</strong>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {item.status === 'clear' ? item.preference : `${item.preference}: ${visual.label}`}
                          </div>
                          {item.status !== 'clear' && <div style={{ fontSize: 11, marginTop: 2 }}>{item.detail}</div>}
                        </div>
                      </div>
                    })}
                  </div>
                )}
                {packageDetails.statements.contains.length > 0 && <div style={{ fontSize: 12, color: T.muted, marginTop: 9 }}>Declared: {packageDetails.statements.contains.map(titleCase).join(', ')}</div>}
                {packageDetails.statements.traces.length > 0 && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>May contain: {packageDetails.statements.traces.map(titleCase).join(', ')}</div>}
              </section>

              <section style={card}>
                <div style={sectionLabel}>Nutrition per 100 g</div>
                {nutritionRows.map(([name, display]) => <div key={name} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.line}` }}>
                  <span style={{ flex: 1, color: T.ink, fontSize: 14 }}>{name}</span>
                  <strong style={{ color: T.ink, fontSize: 14 }}>{display}</strong>
                </div>)}
                {!packageDetails.nutrition && <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.45, marginTop: 9 }}>
                  The nutrition panel was not clear enough to read. Try a closer photo or select the nutrition area yourself.
                </div>}
                {packageDetails.nutrition && packageDetails.nutrition.confirmedRows === 0 && (
                  <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.45, marginTop: 9 }}>
                    These figures could not be checked against the label own
                    %DI column, so treat them as approximate and compare with
                    the package.
                  </div>
                )}
              </section>
            </div>
          )}
          {addedLabels.size > 0 && (
            <button onClick={() => navigate('/confirm')} style={{
              ...btnBase, marginTop: 14, background: T.green, color: '#fff', cursor: 'pointer',
            }}>
              View my list ({addedLabels.size})
            </button>
          )}
        </div>
      )}

      {/* 隐私提醒 */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{
          background: T.tomatoSoft, borderRadius: 14, padding: '12px 14px',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.tomato}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span style={{ fontSize: 13, color: T.tomato, fontWeight: 600 }}>
            Text is read on this device only. Your photo is never uploaded.
          </span>
        </div>
      </div>
    </div>
  )
}
