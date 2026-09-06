import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'

// —— 逻辑常量：原样保留 ——
const CREEP_CEILING = 90
const TICK_MS = 50
const TICK_STEP = 4
const SETTLE_MS = 350

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7', tomato: '#C6492B',
}

export default function Processing() {
  const navigate = useNavigate()
  const { detection } = useAppState()
  const [creep, setCreep] = useState(0)
  const { status } = detection
  const pct = status === 'done' ? 100 : creep

  const steps = [
    { label: 'Preparing your photo', at: 20 },
    { label: 'Detecting ingredients', at: 95 },
    { label: 'Building your ingredient list', at: 100 },
  ]

  // —— 以下三个 effect 是核心流程控制，原样保留 ——
  useEffect(() => {
    if (status === 'idle') navigate('/capture', { replace: true })
  }, [status, navigate])

  useEffect(() => {
    if (status !== 'running') return
    const iv = setInterval(() => {
      setCreep(p => (p >= CREEP_CEILING ? p : Math.min(CREEP_CEILING, p + TICK_STEP)))
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [status])

  useEffect(() => {
    if (status !== 'done') return
    const t = setTimeout(() => navigate('/confirm', { replace: true }), SETTLE_MS)
    return () => clearTimeout(t)
  }, [status, navigate])

  const C = 2 * Math.PI * 64

  // —— 错误状态 ——
  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        maxWidth: 430, margin: '0 auto', padding: '40px 20px 30px',
      }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.ink, letterSpacing: -0.6, lineHeight: 1.1 }}>
          That photo<br />didn't work
        </div>
        <div style={{ fontSize: 15, color: T.sub, marginTop: 12, lineHeight: 1.5 }}>
          {detection.error || 'Something went wrong while reading the photo.'}
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 28 }}>
          <button
            onClick={() => navigate('/capture', { replace: true })}
            style={{
              width: '100%', border: 'none', borderRadius: 2, fontFamily: 'inherit',
              fontWeight: 600, fontSize: 16, padding: '16px 18px',
              background: T.green, color: '#fff', cursor: 'pointer',
            }}>
            Try another photo
          </button>
          <button
            onClick={() => navigate('/scan-package')}
            style={{
              width: '100%', borderRadius: 2, fontFamily: 'inherit', fontWeight: 600,
              fontSize: 15, padding: '15px 18px', cursor: 'pointer',
              background: T.bg, color: T.green, border: `1px solid ${T.line}`,
            }}>
            Scan a package label instead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      <div style={{ padding: '48px 20px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>
          Processing locally
        </div>
        <div style={{ fontSize: 13, color: T.faint, marginTop: 6 }}>
          {status === 'done' ? 'Almost there' : 'Nothing leaves your phone'}
        </div>
      </div>

      {/* 圆环进度（直角审美下圆环保留，是数据可视化） */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '24px 0 4px' }}>
        <div style={{ position: 'relative', width: 150, height: 150 }}>
          <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="75" cy="75" r="64" fill="none" stroke={T.fill} strokeWidth="10" />
            <circle cx="75" cy="75" r="64" fill="none" stroke={T.green} strokeWidth="10"
              strokeLinecap="butt" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset .25s ease-out' }} />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            fontSize: 32, fontWeight: 700, color: T.ink,
            fontFamily: 'ui-monospace, monospace', letterSpacing: -1,
          }}>{pct}%</div>
        </div>
      </div>

      {/* 步骤清单 */}
      <div style={{ padding: '28px 32px 0', display: 'grid', gap: 14 }}>
        {steps.map(s => {
          const done = pct >= s.at
          const active = !done && pct >= s.at - 35
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 2, display: 'grid', placeItems: 'center',
                background: done ? T.green : active ? T.ink : T.fill,
                color: '#fff',
              }}>
                {done && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 14, color: done ? T.ink : T.faint }}>{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* 隐私提醒 */}
      <div style={{ padding: '32px 20px 0' }}>
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
            Your image is processed on this device only.
          </span>
        </div>
      </div>
    </div>
  )
}