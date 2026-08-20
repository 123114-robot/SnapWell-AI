import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

export default function Processing() {
  const navigate = useNavigate()
  const { ingredients } = useAppState()
  const [pct, setPct] = useState(0)

  const steps = [
    { label: 'Loading AI model (YOLOv8-nano)', at: 25 },
    { label: 'Detecting ingredients', at: 60 },
    { label: 'Reading results', at: 90 },
    { label: 'Done', at: 100 },
  ]

  // 进度动画：跑满后跳到结果屏
  useEffect(() => {
    const iv = setInterval(() => {
      setPct(p => {
        if (p >= 100) {
          clearInterval(iv)
          setTimeout(() => navigate('/results'), 350)
          return 100
        }
        return p + 4
      })
    }, 50)
    return () => clearInterval(iv)
  }, [navigate])

  const C = 2 * Math.PI * 64  // 圆环周长

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      <div style={{ padding: '28px 20px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Processing locally</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>This only takes a moment</div>
      </div>

      {/* 圆环进度 */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '12px 0 4px' }}>
        <div style={{ position: 'relative', width: 150, height: 150 }}>
          <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="75" cy="75" r="64" fill="none" stroke={T.greenSoft} strokeWidth="12" />
            <circle cx="75" cy="75" r="64" fill="none" stroke={T.green} strokeWidth="12"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset .1s linear' }} />
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