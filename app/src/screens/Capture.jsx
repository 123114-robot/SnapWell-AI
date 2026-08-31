import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModel } from '../ai/ModelContext.jsx'
import { useAppState } from '../state/AppState.jsx'
import { detect, mergeDetectionsByLabel } from '../ai/detector.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

export default function Capture() {
  const navigate = useNavigate()
  const { session, status } = useModel()
  const { setPhoto, setIngredients } = useAppState()
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  // 用户选好照片后：跑检测 → 存结果 → 跳转
    async function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const image = new Image()
    image.onload = async () => {
      setPhoto(image)
      navigate('/processing')   // 先跳到处理动画屏
      // 在后台跑检测，结果存进仓库；Processing 屏跑完动画后会跳到 /results
      const r = await detect(session.current, image)
      setIngredients(mergeDetectionsByLabel(r.detections))
    }
    image.src = URL.createObjectURL(file)
  }

  const ready = status === 'ready' && !busy

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/preferences')} style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10,
          width: 34, height: 34, display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: T.ink, flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Add your ingredients</div>
      </div>

      {/* 取景框区域 */}
      <div style={{ padding: '6px 20px 0' }}>
        <div style={{
          borderRadius: 22, background: 'linear-gradient(160deg,#2a3b31,#4a5a4d)',
          position: 'relative', overflow: 'hidden', height: 360,
          display: 'grid', placeItems: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 24, border: '2px dashed rgba(255,255,255,.5)', borderRadius: 16 }} />
          {busy ? (
            <div style={{ color: '#fff', textAlign: 'center', position: 'relative' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Detecting on your device…</div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>This runs locally, no upload</div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,.9)', textAlign: 'center', position: 'relative' }}>
              <div style={{ fontSize: 64 }}>🥕🍅🥦</div>
              <div style={{ fontSize: 13, marginTop: 10, opacity: 0.85 }}>
                Position your ingredients, good lighting helps
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 隐藏的文件选择器 + 两个按钮触发它 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        disabled={!ready}
        style={{ display: 'none' }}
      />

      <div style={{ padding: '20px 20px 0', display: 'grid', gap: 12 }}>
        <button
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={!ready}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', border: 'none', borderRadius: 14,
            fontFamily: 'inherit', fontWeight: 600, fontSize: 15, padding: '14px 18px',
            background: ready ? T.green : '#9fb0a5', color: '#fff',
            cursor: ready ? 'pointer' : 'default',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {busy ? 'Working…' : 'Take or choose a photo'}
        </button>

        {status !== 'ready' && (
          <div style={{ textAlign: 'center', fontSize: 13, color: T.muted }}>
            Loading AI model… please wait
          </div>
        )}
      </div>

      {/* 隐私提醒 */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{
          background: T.tomatoSoft, borderRadius: 14, padding: '12px 14px',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.tomato}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span style={{ fontSize: 13, color: T.tomato, fontWeight: 600 }}>
            Your photo is processed on this device only.
          </span>
        </div>
      </div>
    </div>
  )
}