import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { useModel } from '../ai/useModel.js'
import { displayName } from '../ai/ingredientMatch.js'
import { emojiForIngredient } from '../data/foodData.js'
import { detect, mergeDetectionsByLabel } from '../ai/detector.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7', tomato: '#C6492B', amber: '#7A5200',
}

export default function IngredientConfirm() {
  const navigate = useNavigate()
  const { ingredients, setIngredients, preferences, detection } = useAppState()
  const { session, status } = useModel()
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)      // 本地"检测中"状态，不碰全局 detection
  const [addError, setAddError] = useState('')
  const fileRef = useRef(null)
  const cameraRef = useRef(null)

  const isEmpty = ingredients.length === 0
  const detectionFinished = detection.status === 'done'
  const modelReady = status === 'ready'

  function removeItem(id) {
    setIngredients(ingredients.filter(it => it.id !== id))
  }

  function addItem() {
    const name = newName.trim().toLowerCase()
    if (!name) return
    setIngredients([...ingredients, {
      id: Date.now(), label: name, confidence: null,
      quantity: 1, unit: 'piece', source: 'manual', bbox: null,
    }])
    setNewName('')
  }

  // 用当前列表 + 新检测结果做去重合并（同名的合并，避免重复）
  function mergeInto(existing, incoming) {
    const byLabel = new Map(existing.map(it => [it.label, it]))
    for (const det of incoming) {
      if (byLabel.has(det.label)) {
        // 已有同名食材：数量累加，保留原来的
        const prev = byLabel.get(det.label)
        byLabel.set(det.label, { ...prev, quantity: (prev.quantity || 1) + (det.quantity || 1) })
      } else {
        byLabel.set(det.label, { ...det, id: det.id ?? Date.now() + Math.random() })
      }
    }
    return [...byLabel.values()]
  }

  // 从相机/相册选了照片 → 原地检测 → 追加（不跳走、不动全局 detection 状态）
  function onPhoto(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setAddError('')
    const image = new Image()
    image.onload = async () => {
      setAdding(true)
      try {
        const r = await detect(session.current, image)
        const merged = mergeDetectionsByLabel(r.detections)
        if (merged.length === 0) {
          setAddError('No new ingredients recognised in that photo.')
        } else {
          setIngredients(prev => mergeInto(prev, merged))
        }
      } catch (err) {
        console.error('detection failed', err)
        setAddError('Could not read that photo. Try a closer, brighter one.')
      } finally {
        setAdding(false)
      }
    }
    image.onerror = () => setAddError('That file could not be opened as a photo.')
    image.src = URL.createObjectURL(file)
  }

  const diets = (preferences.diets || [])
  const allergies = (preferences.allergies || [])

  function sourceLabel(source) {
    if (source === 'manual') return { text: 'Added', color: T.green }
    if (source === 'ocr') return { text: 'Label', color: T.ink }
    if (source === 'product') return { text: 'Product', color: T.ink }
    return { text: 'Detected', color: T.green }
  }
  function safetyLabel(s) {
    if (s === 'conflict') return { text: 'Allergy conflict', color: T.tomato }
    if (s === 'trace') return { text: 'May contain', color: T.amber }
    if (s === 'unknown') return { text: 'Safety unknown', color: T.faint }
    return { text: 'Checked', color: T.faint }
  }

  const outlineBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: T.bg, color: T.green, border: `1px solid ${T.line}`, borderRadius: 2,
    padding: '13px 14px', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5,
    cursor: modelReady && !adding ? 'pointer' : 'default',
    opacity: modelReady && !adding ? 1 : 0.5,
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/capture')} style={{
          background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2,
          width: 36, height: 36, display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: T.ink,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* 大标题 */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: -0.7, lineHeight: 1.1 }}>
          Confirm ingredients
        </div>
        <p style={{ fontSize: 14, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
          {isEmpty ? 'Nothing on your list yet.' : 'Add more, or remove anything wrong.'}
        </p>
      </div>

      {/* 列表 */}
      <div style={{ padding: '24px 20px 0', display: 'grid', gap: 10 }}>
        {isEmpty && !adding && (
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: '26px 20px', textAlign: 'center', color: T.sub, fontSize: 13.5, lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 8 }}>
              {detectionFinished ? 'No ingredients recognised' : 'Your list is empty'}
            </div>
            <div>
              {detectionFinished
                ? 'SnapWell recognises 39 fresh ingredients. Try a closer photo, or add items below.'
                : 'Snap a photo, scan a package, or type an item below.'}
            </div>
          </div>
        )}

        {ingredients.map(it => {
          const src = sourceLabel(it.source)
          const safe = it.safetyStatus ? safetyLabel(it.safetyStatus) : null
          return (
            <div key={it.id} style={{
              background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2,
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 26 }}>{emojiForIngredient(it.label)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: T.ink }}>
                  {displayName(it.label)}
                  {(it.quantity || 1) > 1 && (
                    <span style={{ color: T.faint, fontWeight: 600 }}> ×{it.quantity}</span>
                  )}
                </div>
                {it.productName && (
                  <button type="button" onClick={() => navigate(`/product/${it.barcode}`, { state: { from: '/confirm' } })} style={{
                    display: 'block', background: 'none', border: 'none', padding: '3px 0 0',
                    color: T.faint, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  }}>
                    {it.brand ? `${it.brand} · ` : ''}{it.productName}
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: src.color, letterSpacing: 0.2 }}>
                    {src.text.toUpperCase()}
                  </span>
                  {safe && <span style={{ fontSize: 11, fontWeight: 600, color: safe.color }}>{safe.text}</span>}
                  {it.confidence != null && (
                    <span style={{ fontSize: 11, color: T.faint, fontFamily: 'ui-monospace, monospace' }}>
                      {Math.round(it.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => removeItem(it.id)} style={{
                width: 34, height: 34, borderRadius: 2, background: T.bg,
                border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center',
                cursor: 'pointer', color: T.tomato,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          )
        })}

        {/* 检测中提示 */}
        {adding && (
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: '14px', textAlign: 'center', color: T.sub, fontSize: 13.5,
          }}>
            Detecting more ingredients…
          </div>
        )}
      </div>

      {/* 三个添加入口：拍照 / 上传 / 扫码 */}
      <div style={{ padding: '16px 20px 0' }}>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
        <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {/* 拍照 */}
          <button onClick={() => modelReady && !adding && cameraRef.current?.click()} style={outlineBtn}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Photo
          </button>
          {/* 上传 */}
          <button onClick={() => modelReady && !adding && fileRef.current?.click()} style={outlineBtn}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            Upload
          </button>
          {/* 扫码 */}
          <button onClick={() => navigate('/scan-package', { state: { from: '/confirm' } })} style={{ ...outlineBtn, opacity: 1, cursor: 'pointer' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
              <path d="M8 9h8M8 12h8M8 15h5" />
            </svg>
            Barcode
          </button>
        </div>

        {!modelReady && (
          <div style={{ fontSize: 12, color: T.faint, marginTop: 8, textAlign: 'center' }}>
            Loading AI model… photo detection will be ready shortly.
          </div>
        )}
        {addError && (
          <div style={{ fontSize: 13, color: T.tomato, marginTop: 10, lineHeight: 1.45 }}>{addError}</div>
        )}
      </div>

      {/* 手动输入 */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
            placeholder="Or type an ingredient…"
            style={{
              flex: 1, border: `1px solid ${T.line}`, borderRadius: 2,
              padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, outline: 'none',
            }}
          />
          <button onClick={addItem} style={{
            background: T.green, color: '#fff', border: 'none', borderRadius: 2,
            padding: '0 18px', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>Add</button>
        </div>
      </div>

      {/* 已选偏好 */}
      {(diets.length > 0 || allergies.length > 0) && (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: T.faint,
            textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
          }}>Applied preferences</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...diets, ...allergies].map(p => (
              <span key={p} style={{
                background: T.fill, color: T.ink, fontWeight: 500,
                fontSize: 12, padding: '5px 10px', borderRadius: 2,
              }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* 继续 */}
      <div style={{ padding: '28px 20px 0' }}>
        <button
          disabled={isEmpty || adding}
          style={{
            width: '100%', border: 'none', borderRadius: 2, fontFamily: 'inherit',
            fontWeight: 600, fontSize: 16, padding: '16px 18px',
            background: (isEmpty || adding) ? '#B7C1BB' : T.green, color: '#fff',
            cursor: (isEmpty || adding) ? 'default' : 'pointer',
          }}
          onClick={() => navigate('/quantity')}>
          Continue
        </button>
      </div>
    </div>
  )
}