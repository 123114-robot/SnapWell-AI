import { useNavigate } from 'react-router-dom'

// 设计配色（桉树绿 + 金合欢黄 + 番茄红隐私标识）
const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

// On-device 隐私标识（番茄红，专用）
function OnDeviceChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: T.tomatoSoft, color: T.tomato, fontWeight: 600,
      fontSize: 12, padding: '5px 10px', borderRadius: 999,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      On-device
    </span>
  )
}

export default function Home() {
  const navigate = useNavigate()

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', border: 'none', cursor: 'pointer', borderRadius: 14,
    fontFamily: 'inherit', fontWeight: 600, fontSize: 15, padding: '14px 18px',
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部品牌 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 20px 0' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: T.green,
          display: 'grid', placeItems: 'center', color: T.wattle,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.8L20 10.7l-5.8 1.9L12 18l-1.9-5.4L4 10.7l6.1-1.9z" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 20, color: T.ink }}>SnapWell</span>
      </div>

      {/* 主视觉卡片 */}
      <div style={{
        margin: '18px 20px 0', background: T.green, borderRadius: 22,
        padding: 24, color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, fontSize: 120, opacity: 0.12 }}>🥗</div>
        <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.15, maxWidth: 250 }}>
          Cook smarter with what you already have
        </div>
        <p style={{ fontSize: 13, opacity: 0.85, marginTop: 12, maxWidth: 260, lineHeight: 1.5 }}>
          Snap your ingredients, check the results, and get recipes built for Australian kitchens.
        </p>
        <div style={{ marginTop: 14 }}><OnDeviceChip /></div>
      </div>

      {/* 按钮 */}
      <div style={{ padding: '20px 20px 0', display: 'grid', gap: 12 }}>
        <button style={{ ...btnBase, background: T.green, color: '#fff' }}
          onClick={() => navigate('/capture')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Open camera
        </button>
        <button style={{ ...btnBase, background: '#fff', color: T.green, border: `1.5px solid ${T.greenLine}` }}
          onClick={() => navigate('/capture')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Upload image
        </button>
        <button style={{ ...btnBase, background: 'transparent', color: T.green, padding: '8px 18px' }}
          onClick={() => navigate('/scan-package')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
            <path d="M8 9h8M8 12h8M8 15h5" />
          </svg>
          Scan a package label
        </button>
      </div>

      {/* 底部说明 */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{
          fontWeight: 700, fontSize: 12, color: T.muted,
          textTransform: 'uppercase', letterSpacing: 0.6,
        }}>How it works</div>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {[
            ['1', 'Snap or upload a photo of your ingredients'],
            ['2', 'Review what we detected — edit anything'],
            ['3', 'Get recipes matched to what you have'],
          ].map(([n, text]) => (
            <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: T.greenSoft,
                color: T.green, fontWeight: 700, fontSize: 13,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>{n}</div>
              <span style={{ fontSize: 14, color: T.ink }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}