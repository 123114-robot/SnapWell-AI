import { useNavigate } from 'react-router-dom'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', border: 'none', cursor: 'pointer', borderRadius: 14,
    fontFamily: 'inherit', fontWeight: 600, fontSize: 15, padding: '14px 18px',
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部：返回 + 标题 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/')} style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10,
          width: 34, height: 34, display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: T.ink, flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginTop: 3 }}>
          Your privacy matters
        </div>
      </div>

      {/* 盾牌图标 */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 6px' }}>
        <div style={{
          position: 'relative', width: 120, height: 120,
          display: 'grid', placeItems: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: T.tomatoSoft, borderRadius: '50%' }} />
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={T.tomato}
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'relative' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
      </div>

      {/* 三条承诺 */}
      <div style={{ padding: '10px 24px 0', display: 'grid', gap: 16 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ color: T.tomato, marginTop: 1, flexShrink: 0 }}><CheckIcon /></div>
            <span style={{ fontSize: 15, color: T.ink, lineHeight: 1.45 }}>{b}</span>
          </div>
        ))}
      </div>

      {/* 按钮 */}
      <div style={{ padding: '28px 20px 0', display: 'grid', gap: 10 }}>
        <button style={{ ...btnBase, background: T.green, color: '#fff' }}
          onClick={() => navigate('/preferences')}>
          Continue
        </button>
        <button style={{ ...btnBase, background: 'transparent', color: T.green }}
          onClick={() => navigate('/preferences')}>
          Learn more
        </button>
      </div>
    </div>
  )
}
