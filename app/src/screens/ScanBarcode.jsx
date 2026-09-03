import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isPlaceholderBarcode, normaliseBarcode } from '../product/productData.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332', greenSoft: '#E7EFE9',
  greenLine: '#CBDDD0', wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC', muted: '#5E6E64', line: '#E4E0D6',
}

const RETAIL_FORMAT_NAMES = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E']

async function createRetailReader(options) {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, RETAIL_FORMAT_NAMES.map((name) => BarcodeFormat[name]))
  hints.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(hints, options)
}

function loadPhoto(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The barcode photo could not be opened.'))
    image.src = url
  })
}

function rotatedCanvas(image, quarterTurns) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const maxEdge = 2000
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
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

/**
 * A single decode can return a checksum-valid false positive on a rotated,
 * low-contrast retail barcode. Decode four orientations and require the same
 * value from both directions before trusting it automatically.
 */
async function decodePhotoWithConsensus(reader, url) {
  const image = await loadPhoto(url)
  const candidates = []
  for (const quarterTurns of [1, 3, 0, 2]) {
    try {
      const result = await reader.decodeFromCanvas(rotatedCanvas(image, quarterTurns))
      const code = normaliseBarcode(result.getText())
      if (code) candidates.push(code)
    } catch {
      // A failed orientation is expected; the other passes still get a turn.
    }
  }
  const counts = new Map()
  candidates.forEach((code) => counts.set(code, (counts.get(code) || 0) + 1))
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (ranked[0]?.[1] >= 2) return ranked[0][0]
  if (ranked.length === 1) return ranked[0][0]
  throw new Error('The photo produced conflicting barcode readings.')
}

export default function ScanBarcode() {
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = location.state?.from || '/capture'
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const cameraFileRef = useRef(null)
  const controlsRef = useRef(null)
  const readerRef = useRef(null)
  const handledRef = useRef(false)
  const liveDetectionsRef = useRef(new Map())
  const [mode, setMode] = useState('idle')
  const [manual, setManual] = useState('')
  const [error, setError] = useState('')

  function stopCamera() {
    controlsRef.current?.stop()
    controlsRef.current = null
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => () => stopCamera(), [])

  function openProduct(rawCode) {
    if (isPlaceholderBarcode(rawCode)) {
      stopCamera()
      setMode('idle')
      setError('This image contains a known example barcode. Enter the digits printed below the bars instead.')
      return
    }
    const code = normaliseBarcode(rawCode)
    if (!code) {
      setError('That does not look like a valid retail barcode. Check the digits and try again.')
      return
    }
    if (handledRef.current) return
    handledRef.current = true
    stopCamera()
    navigator.vibrate?.(80)
    navigate(`/product/${code}`, { state: { from: backTo } })
  }

  async function startCamera() {
    stopCamera()
    handledRef.current = false
    liveDetectionsRef.current = new Map()
    setError('')
    setMode('starting')
    try {
      const reader = await createRetailReader({
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 350,
      })
      readerRef.current = reader
      const controls = await reader.decodeFromConstraints({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }, videoRef.current, (result) => {
        if (!result) return
        const code = normaliseBarcode(result.getText())
        if (!code) return
        const seen = (liveDetectionsRef.current.get(code) || 0) + 1
        liveDetectionsRef.current.set(code, seen)
        if (seen >= 2) openProduct(code)
      })
      controlsRef.current = controls
      setMode('scanning')
    } catch (err) {
      console.error(err)
      stopCamera()
      setMode('idle')
      setError('Camera scanning is unavailable. Choose a barcode photo or enter the number instead.')
    }
  }

  function openCameraScanner() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    // getUserMedia requires HTTPS away from localhost. On iPhone, a dedicated
    // rear-camera file input also avoids WebKit live-scanner permission issues.
    if (isIos || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      stopCamera()
      setError('')
      cameraFileRef.current?.click()
      return
    }
    startCamera()
  }

  async function scanPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setMode('photo')
    const url = URL.createObjectURL(file)
    try {
      const reader = readerRef.current || await createRetailReader()
      readerRef.current = reader
      const code = await decodePhotoWithConsensus(reader, url)
      openProduct(code)
    } catch (err) {
      console.error(err)
      setMode('idle')
      setError(err.message === 'The photo produced conflicting barcode readings.'
        ? 'The barcode readings did not agree. Try a closer photo, or enter the printed digits below.'
        : 'No reliable barcode was found in that photo. Try a closer image with the full barcode visible.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function submitManual(event) {
    event.preventDefault()
    handledRef.current = false
    openProduct(manual)
  }

  const btn = {
    width: '100%', border: 'none', borderRadius: 14, padding: '14px 18px',
    fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button type="button" onClick={() => { stopCamera(); navigate(backTo) }} aria-label="Go back" style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10,
          width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer',
          color: T.ink, flexShrink: 0, marginTop: 3,
        }}>‹</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Scan barcode</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.45 }}>
            See the allergens and nutrition for this product
          </div>
        </div>
      </div>

      <div style={{ padding: '6px 20px 0' }}>
        <div style={{
          height: 300, borderRadius: 22, overflow: 'hidden', position: 'relative',
          background: 'linear-gradient(160deg,#26382e,#48584b)', display: 'grid', placeItems: 'center',
        }}>
          <video ref={videoRef} muted playsInline style={{
            display: mode === 'scanning' || mode === 'starting' ? 'block' : 'none',
            width: '100%', height: '100%', objectFit: 'cover',
          }} />
          {(mode === 'idle' || mode === 'photo') && (
            <div style={{ color: '#fff', textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 52, letterSpacing: -5 }}>▥▥▥</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 10 }}>
                Keep the whole barcode flat and well lit
              </div>
            </div>
          )}
          {(mode === 'scanning' || mode === 'starting') && (
            <div style={{
              position: 'absolute', left: 34, right: 34, top: '50%', height: 96,
              transform: 'translateY(-50%)', border: `3px solid ${T.wattle}`,
              borderRadius: 14, boxShadow: '0 0 0 999px rgba(0,0,0,.28)',
            }} />
          )}
          {mode === 'starting' && (
            <div style={{ position: 'absolute', color: '#fff', fontWeight: 600, fontSize: 14 }}>
              Starting camera…
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px 0', display: 'grid', gap: 10 }}>
        {mode === 'scanning' ? (
          <button type="button" onClick={() => { stopCamera(); setMode('idle') }} style={{
            ...btn, background: '#fff', color: T.green, border: `1.5px solid ${T.greenLine}`,
          }}>Stop camera</button>
        ) : (
          <button type="button" onClick={openCameraScanner} disabled={mode === 'starting' || mode === 'photo'} style={{
            ...btn, background: T.green, color: '#fff', opacity: mode === 'photo' ? 0.6 : 1,
          }}>Scan barcode with camera</button>
        )}

        <input ref={cameraFileRef} type="file" accept="image/*" capture="environment" onChange={scanPhoto} style={{ display: 'none' }} />
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" onChange={scanPhoto} style={{ display: 'none' }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={mode === 'photo'} style={{
          ...btn, background: '#fff', color: T.green, border: `1.5px solid ${T.greenLine}`,
        }}>{mode === 'photo' ? 'Checking barcode from several angles…' : 'Choose from photo library'}</button>

        {error && <div role="alert" style={{
          background: T.tomatoSoft, color: T.tomato, borderRadius: 12,
          padding: '11px 13px', fontSize: 13, fontWeight: 600, lineHeight: 1.45,
        }}>{error}</div>}

        {/* Loose meat, bakery and deli packs often carry no retail barcode at
            all, so reading the label is a route of its own rather than a
            weaker way to scan. It sits above manual entry: typing thirteen
            digits off a package is the last thing anyone should be asked. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 2px' }}>
          <div style={{ flex: 1, height: 1, background: T.line }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.8 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: T.line }} />
        </div>

        <button type="button" onClick={() => {
          stopCamera()
          navigate('/scan-package/label', { state: { from: backTo } })
        }} style={{
          display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
          background: T.wattleSoft, border: `1.5px solid ${T.wattle}`, borderRadius: 16,
          padding: '14px 15px', fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: T.wattle,
            display: 'grid', placeItems: 'center', color: T.ink,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="13" y2="17" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>
              No barcode on this package?
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>
              Read the ingredients and nutrition label instead
            </div>
          </div>
        </button>

        <form onSubmit={submitManual} style={{ marginTop: 8 }}>
          <label htmlFor="barcode-input" style={{ fontSize: 12, fontWeight: 700, color: T.muted }}>
            ENTER BARCODE MANUALLY
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
            <input id="barcode-input" value={manual} onChange={(event) => setManual(event.target.value)}
              inputMode="numeric" autoComplete="off" placeholder="8–14 digits" style={{
                minWidth: 0, flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 12,
                padding: '12px 13px', fontFamily: 'inherit', fontSize: 16, background: '#fff',
              }} />
            <button type="submit" style={{
              border: 'none', borderRadius: 12, padding: '0 17px', background: T.wattle,
              color: T.ink, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer',
            }}>Look up</button>
          </div>
        </form>
      </div>

      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ background: T.tomatoSoft, color: T.tomato, borderRadius: 14, padding: '12px 14px', fontSize: 13, lineHeight: 1.45 }}>
          Barcode recognition stays on this device. Only the barcode number is sent for product lookup; no photo is uploaded.
        </div>
      </div>
    </div>
  )
}
