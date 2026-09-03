import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'

// 检测还在跑时，进度环最多爬到这里。剩下的 10% 留给"真的跑完了"。
const CREEP_CEILING = 90
const TICK_MS = 50
const TICK_STEP = 4
// 进度环补满到 100% 后停留片刻，免得画面一闪而过。
const SETTLE_MS = 350

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

export default function Processing() {
  const navigate = useNavigate()
  const { detection } = useAppState()
  const [creep, setCreep] = useState(0)
  const { status } = detection
  // 显示值直接由检测状态推出来：没跑完最多 CREEP_CEILING，跑完就是 100%。
  const pct = status === 'done' ? 100 : creep

  const steps = [
    { label: 'Preparing your photo', at: 20 },
    { label: 'Detecting ingredients', at: 95 },
    { label: 'Building your ingredient list', at: 100 },
  ]

  // 没有正在跑的检测就说明是刷新或直接输网址进来的，退回拍照页。
  useEffect(() => {
    if (status === 'idle') navigate('/capture', { replace: true })
  }, [status, navigate])

  // 检测期间进度环慢慢爬，但最多到 CREEP_CEILING —— 没跑完就不该显示 100%。
  useEffect(() => {
    if (status !== 'running') return
    const iv = setInterval(() => {
      setCreep(p => (p >= CREEP_CEILING ? p : Math.min(CREEP_CEILING, p + TICK_STEP)))
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [status])

  // 检测真的完成后停留一下再放行。最后那 10% 由 pct 直接推出来、靠圆环的 CSS
  // 过渡补满，不交给计时器慢慢爬：切到后台的标签页会被浏览器把 setInterval
  // 压到每分钟一次，那样用户会永远卡在这一屏。
  useEffect(() => {
    if (status !== 'done') return
    const t = setTimeout(() => navigate('/confirm', { replace: true }), SETTLE_MS)
    return () => clearTimeout(t)
  }, [status, navigate])

  const C = 2 * Math.PI * 64  // 圆环周长

  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
        maxWidth: 430, margin: '0 auto', padding: '28px 20px 30px',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>That photo didn't work</div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
          {detection.error || 'Something went wrong while reading the photo.'}
        </div>
        <div style={{ display: 'grid', gap: 12, marginTop: 22 }}>
          <button
            onClick={() => navigate('/capture', { replace: true })}
            style={{
              width: '100%', border: 'none', borderRadius: 14, fontFamily: 'inherit',
              fontWeight: 600, fontSize: 15, padding: '14px 18px',
              background: T.green, color: '#fff', cursor: 'pointer',
            }}>
            Try another photo
          </button>
          <button
            onClick={() => navigate('/scan-package')}
            style={{
              width: '100%', borderRadius: 14, fontFamily: 'inherit', fontWeight: 600,
              fontSize: 15, padding: '14px 18px', cursor: 'pointer',
              background: '#fff', color: T.green, border: `1.5px solid ${T.greenLine}`,
            }}>
            Scan a package label instead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      <div style={{ padding: '28px 20px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Processing locally</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
          {status === 'done' ? 'Almost there' : 'Nothing leaves your phone'}
        </div>
      </div>

      {/* 圆环进度 */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '12px 0 4px' }}>
        <div style={{ position: 'relative', width: 150, height: 150 }}>
          <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="75" cy="75" r="64" fill="none" stroke={T.greenSoft} strokeWidth="12" />
            <circle cx="75" cy="75" r="64" fill="none" stroke={T.green} strokeWidth="12"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset .25s ease-out' }} />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            fontSize: 30, fontWeight: 700, color: T.green,
          }}>{pct}%</div>
        </div>
      </div>

      {/* 步骤清单 */}
      <div style={{ padding: '14px 24px 0', display: 'grid', gap: 12 }}>
        {steps.map(s => {
          const done = pct >= s.at
          const active = !done && pct >= s.at - 35
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: done ? T.green : active ? T.wattleSoft : T.line,
                color: '#fff',
              }}>
                {done && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 14, color: done ? T.ink : T.muted }}>{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* 隐私提醒 */}
      <div style={{ padding: '22px 20px 0' }}>
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
            Your image is processed on this device only.
          </span>
        </div>
      </div>
    </div>
  )
}