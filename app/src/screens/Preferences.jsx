import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
}

const DIETS = ['Vegetarian', 'Vegan', 'Low-calorie', 'High-protein', 'Gluten-free', 'Dairy-free']
const ALLERGIES = [
  'No shellfish', 'No nuts', 'No eggs', 'No soy', 'No milk',
  'No wheat', 'No sesame', 'No fish', 'No lupin', 'No sulphites',
]
const GOALS = ['Weight loss', 'Muscle gain', 'Balanced diet', 'General health']

function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${active ? T.green : T.line}`,
      background: active ? T.green : T.bg,
      color: active ? '#fff' : T.ink,
      borderRadius: 2, padding: '9px 13px', cursor: 'pointer',
      fontFamily: 'inherit', fontWeight: 500, fontSize: 13,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {active && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontWeight: 600, fontSize: 12, color: T.faint,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
    }}>{children}</div>
  )
}

export default function Preferences() {
  const navigate = useNavigate()
  const { preferences, setPreferences } = useAppState()

  const diets = preferences.diets || []
  const allergies = preferences.allergies || []
  const goals = preferences.goals || []

  function toggle(key, value) {
    setPreferences(prev => {
      const list = prev[key] || []
      const next = list.includes(value)
        ? list.filter(x => x !== value)
        : [...list, value]
      return { ...prev, [key]: next }
    })
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部：返回 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/privacy')} style={{
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
          Your preferences
        </div>
        <p style={{ fontSize: 15, color: T.sub, marginTop: 12, lineHeight: 1.5 }}>
          Select anything that applies to you.
        </p>
      </div>

      <div style={{ padding: '32px 20px 0' }}>
        <SectionLabel>Dietary preferences</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DIETS.map(d => (
            <Chip key={d} label={d} active={diets.includes(d)} onClick={() => toggle('diets', d)} />
          ))}
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionLabel>Allergies</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALLERGIES.map(a => (
              <Chip key={a} label={a} active={allergies.includes(a)} onClick={() => toggle('allergies', a)} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionLabel>Health goals (optional)</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOALS.map(g => (
              <Chip key={g} label={g} active={goals.includes(g)} onClick={() => toggle('goals', g)} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '36px 20px 0', display: 'grid', gap: 10 }}>
        <button onClick={() => navigate('/capture')} style={{
          width: '100%', background: T.green, color: '#fff', border: 'none', borderRadius: 2,
          padding: '16px 18px', fontFamily: 'inherit', fontWeight: 600, fontSize: 16, cursor: 'pointer',
        }}>
          Save preferences
        </button>
        <button onClick={() => navigate('/capture')} style={{
          width: '100%', background: T.bg, color: T.sub, border: 'none',
          padding: '12px 18px', fontFamily: 'inherit', fontWeight: 500, fontSize: 14, cursor: 'pointer',
        }}>
          Skip for now
        </button>
      </div>
    </div>
  )
}