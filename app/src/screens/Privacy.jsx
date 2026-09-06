import { useNavigate } from 'react-router-dom'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function Privacy() {
  const navigate = useNavigate()

  const bullets = [
    'SnapWell processes images on your device.',
    'Images are never uploaded for recognition.',
    'For an online product lookup, only the barcode number is sent to Open Food Facts.',
    'You can delete captured images at any time.',
  ]

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部：返回 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/')} style={{
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
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: T.ink, letterSpacing: -0.9, lineHeight: 1.08 }}>
          Your privacy,<br />by design
        </div>
        <p style={{ fontSize: 15, color: T.sub, marginTop: 12, lineHeight: 1.5, maxWidth: 300 }}>
          Recognition runs entirely on your device. Here's exactly what that means.
        </p>
      </div>

      {/* 承诺列表 */}
      <div style={{ padding: '32px 20px 0', display: 'grid', gap: 20 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 2, background: T.green, color: '#fff',
              display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1,
            }}>
              <CheckIcon />
            </div>
            <span style={{ fontSize: 15, color: T.ink, lineHeight: 1.45 }}>{b}</span>
          </div>
        ))}
      </div>

      {/* 按钮 */}
      <div style={{ padding: '36px 20px 0', display: 'grid', gap: 10 }}>
        <button onClick={() => navigate('/preferences')} style={{
          width: '100%', background: T.green, color: '#fff', border: 'none', borderRadius: 2,
          padding: '16px 18px', fontFamily: 'inherit', fontWeight: 600, fontSize: 16, cursor: 'pointer',
        }}>
          Continue
        </button>
        <button onClick={() => navigate('/preferences')} style={{
          width: '100%', background: T.bg, color: T.sub, border: 'none',
          padding: '12px 18px', fontFamily: 'inherit', fontWeight: 500, fontSize: 14, cursor: 'pointer',
        }}>
          Skip
        </button>
      </div>
    </div>
  )
}