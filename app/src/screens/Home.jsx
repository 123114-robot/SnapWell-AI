import { useEffect, useRef, useState } from 'react'
import { useModel } from '../ai/ModelContext.jsx'
import { detect } from '../ai/detector.js'
import { readText } from '../ai/ocr.js'

export default function Home() {
  const { session, status } = useModel()
  const [img, setImg] = useState(null)
  const [dets, setDets] = useState([])
  const [timing, setTiming] = useState(null)
  const [ocr, setOcr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const selRef = useRef(null)

  async function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const image = new Image()
    image.onload = async () => {
      selRef.current = null
      setImg(image); setDets([]); setOcr(null); setSel(null); setBusy(true)
      const r = await detect(session.current, image)
      setDets(r.detections); setTiming(r.timing); setBusy(false)
    }
    image.src = URL.createObjectURL(file)
  }

  useEffect(() => {
    if (img) draw(img, dets, sel)
  }, [img, dets])

  function draw(image, detections, selection) {
    const c = canvasRef.current
    if (!c || !image) return
    c.width = image.width; c.height = image.height
    const ctx = c.getContext('2d')
    ctx.drawImage(image, 0, 0)
    ctx.lineWidth = Math.max(2, image.width / 250)
    ctx.font = Math.max(14, image.width / 40) + 'px sans-serif'
    for (const d of detections) {
      ctx.strokeStyle = '#00c853'
      ctx.strokeRect(d.bbox.x, d.bbox.y, d.bbox.w, d.bbox.h)
      const label = d.label + ' ' + Math.round(d.confidence * 100) + '%'
      ctx.fillStyle = '#00c853'
      const tw = ctx.measureText(label).width
      ctx.fillRect(d.bbox.x, Math.max(0, d.bbox.y - 22), tw + 8, 22)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, d.bbox.x + 4, Math.max(16, d.bbox.y - 5))
    }
    if (selection) {
      ctx.strokeStyle = '#2979ff'
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h)
    }
  }

  function toImageCoords(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    const p = e.touches ? e.touches[0] : e
    return {
      x: (p.clientX - r.left) * (c.width / r.width),
      y: (p.clientY - r.top) * (c.height / r.height)
    }
  }

  function onDown(e) {
    if (!img) return
    e.preventDefault()
    dragRef.current = toImageCoords(e)
  }

  function onMove(e) {
    if (!dragRef.current || !img) return
    e.preventDefault()
    const p = toImageCoords(e)
    const s = dragRef.current
    const box = {
      x: Math.min(s.x, p.x), y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y)
    }
    selRef.current = box
    setSel(box)
    draw(img, dets, box)
  }

  function onUp() { dragRef.current = null }

  async function runOcr() {
    if (!img) return
    const box = selRef.current
    if (!box || box.w < 10 || box.h < 10) {
      setOcr({ text: '', confidence: 0, elapsed: 0,
               note: 'Drag a box over the text you want to read first.' })
      return
    }
    setBusy(true)
    const r = await readText(img, box)
    setOcr(r); setBusy(false)
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4 }}>SnapWell</h2>
      <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>
        Spike A: YOLOv8n detection &middot; Spike B: local package OCR
      </p>

      <input type="file" accept="image/*" capture="environment"
             onChange={onFile} disabled={status !== 'ready' || busy} />

      {timing && (
        <pre style={{ background: '#f5f5f5', padding: 8, fontSize: 13 }}>
{`Preprocess:  ${timing.preprocess.toFixed(0)} ms
Inference:   ${timing.inference.toFixed(0)} ms
Postprocess: ${timing.postprocess.toFixed(0)} ms
Total:       ${timing.total.toFixed(0)} ms
Detected ${dets.length} object(s)`}
        </pre>
      )}

      {img && (
        <>
          <p style={{ fontSize: 13, color: '#666' }}>
            Drag a box over package text, then read it locally.
          </p>
          <canvas ref={canvasRef}
                  style={{ maxWidth: '100%', border: '1px solid #ccc', touchAction: 'none' }}
                  onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
                  onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} />
          <div style={{ marginTop: 8 }}>
            <button onClick={runOcr} disabled={busy}>
              {busy ? 'Working...' : 'Read selected text locally'}
            </button>
          </div>
        </>
      )}

      {ocr && ocr.note && (
        <p style={{ marginTop: 12, color: '#c62828', fontSize: 13 }}>{ocr.note}</p>
      )}

      {ocr && !ocr.note && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, color: '#666' }}>
            OCR completed locally — confidence: {ocr.confidence.toFixed(1)}%,
            total time: {ocr.elapsed.toFixed(0)} ms
          </p>
          <strong>Recognised package text (editable)</strong>
          <textarea key={ocr.elapsed} defaultValue={ocr.text} rows={5}
                    style={{ width: '100%', fontFamily: 'monospace', marginTop: 4 }} />
        </div>
      )}
    </div>
  )
}
