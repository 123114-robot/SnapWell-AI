import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModel } from '../ai/useModel.js'
import {
  DETECTION_DONE, DETECTION_RUNNING, useAppState,
} from '../state/useAppState.js'
import { detect, mergeDetectionsByLabel } from '../ai/detector.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
}

export default function Capture() {
  const navigate = useNavigate()
  const { session, status } = useModel()
  const { setPhoto, setIngredients, setDetection } = useAppState()
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [camError, setCamError] = useState('')

  // —— 核心检测逻辑（接收一个已加载的 Image，原样保留，不改）——
  function runDetection(image) {
    const fail = (message) => setDetection({ status: 'error', error: message })
    setPhoto(image)
    setIngredients([])
    setDetection(DETECTION_RUNNING)
    navigate('/processing')
    ;(async () => {
      try {
        const r = await detect(session.current, image)
        setIngredients(mergeDetectionsByLabel(r.detections))
        setDetection(DETECTION_DONE)
      } catch (err) {
        console.error('detection failed', err)
        fail('The detector could not finish reading this photo.')
      }
    })()
  }

  // 从相册/文件选照片
  function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const image = new Image()
    image.onload = () => runDetection(image)
    image.onerror = () => setDetection({ status: 'error', error: 'That file could not be opened as a photo.' })
    image.src = URL.createObjectURL(file)
    e.target.value = ''
  }

  // 打开摄像头
  async function openCamera() {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },  // 手机优先用后置
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (err) {
      console.error('camera failed', err)
      setCamError('Camera unavailable. You can choose a photo from your library instead.')
      setCameraOn(false)
    }
  }

  // 关闭摄像头
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  // 点快门：从视频截一帧 → 转成 Image → 走检测
  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    stopCamera()
    const image = new Image()
    image.onload = () => runDetection(image)
    image.src = dataUrl
  }

  // 离开页面时确保摄像头关掉（省电、隐私）
  useEffect(() => () => stopCamera(), [])

  const ready = status === 'ready'

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => { stopCamera(); navigate('/preferences') }} style={{
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
          Add ingredients
        </div>
        <p style={{ fontSize: 14, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
          Point your camera at your ingredients, or choose a photo.
        </p>
      </div>

      {/* 取景区：相机开时显示画面，否则显示提示 */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          borderRadius: 2, background: '#14241C',
          position: 'relative', overflow: 'hidden', height: 340,
          display: 'grid', placeItems: 'center',
        }}>
          {/* 视频画面（始终挂载，隐藏时不显示） */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', display: cameraOn ? 'block' : 'none',
            }}
          />

          {/* 取景边框 */}
          <div style={{ position: 'absolute', inset: 20, border: '1px solid rgba(255,255,255,.35)', pointerEvents: 'none' }} />

          {/* 相机未开时的提示 */}
          {!cameraOn && (
            <div style={{ color: 'rgba(255,255,255,.7)', textAlign: 'center', position: 'relative' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <div style={{ fontSize: 13, marginTop: 12, letterSpacing: 0.2 }}>
                Tap "Open camera" to start
              </div>
            </div>
          )}

          {/* 相机开时的快门按钮 */}
          {cameraOn && (
            <button onClick={capture} aria-label="Capture" style={{
              position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
              width: 62, height: 62, borderRadius: '50%', background: '#fff',
              border: '4px solid rgba(255,255,255,.55)', cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,.3)',
            }} />
          )}
        </div>
      </div>

      {/* 隐藏文件选择器 */}
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

      <div style={{ padding: '20px 20px 0', display: 'grid', gap: 10 }}>
        {/* 打开/关闭相机 */}
        {!cameraOn ? (
          <button
            onClick={openCamera}
            disabled={!ready}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              width: '100%', border: 'none', borderRadius: 2,
              fontFamily: 'inherit', fontWeight: 600, fontSize: 16, padding: '16px 18px',
              background: ready ? T.green : '#B7C1BB', color: '#fff',
              cursor: ready ? 'pointer' : 'default',
            }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Open camera
          </button>
        ) : (
          <button
            onClick={stopCamera}
            style={{
              width: '100%', borderRadius: 2, fontFamily: 'inherit', fontWeight: 600,
              fontSize: 15, padding: '14px 18px', cursor: 'pointer',
              background: T.bg, color: T.green, border: `1px solid ${T.line}`,
            }}>
            Close camera
          </button>
        )}

        {/* 从相册选照片 */}
        <button
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={!ready}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            width: '100%', borderRadius: 2, fontFamily: 'inherit', fontWeight: 600,
            fontSize: 15, padding: '15px 18px',
            background: T.bg, color: T.green, border: `1px solid ${T.line}`,
            cursor: ready ? 'pointer' : 'default',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Choose from library
        </button>

        {camError && (
          <div style={{ fontSize: 13, color: '#C6492B', lineHeight: 1.45 }}>{camError}</div>
        )}
        {status !== 'ready' && (
          <div style={{ textAlign: 'center', fontSize: 13, color: T.faint }}>
            Loading AI model… please wait
          </div>
        )}

        {/* 扫条形码入口 */}
        <button
          onClick={() => { stopCamera(); navigate('/scan-package') }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            width: '100%', borderRadius: 2, fontFamily: 'inherit', fontWeight: 600,
            fontSize: 15, padding: '15px 18px', cursor: 'pointer',
            background: T.bg, color: T.green, border: `1px solid ${T.line}`,
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
            <path d="M8 9h8M8 12h8M8 15h5" />
          </svg>
          Scan a product barcode
        </button>
      </div>

      {/* 隐私提醒 */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          background: T.fill, borderRadius: 2, padding: '13px 15px',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span style={{ fontSize: 13, color: T.sub }}>
            Your photo is processed on this device only.
          </span>
        </div>
      </div>
    </div>
  )
}