import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
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
      border: `1.5px solid ${active ? T.green : T.line}`,
      background: active ? T.greenSoft : '#fff',
      color: active ? T.green : T.ink,
      borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
      fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {active && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
      fontWeight: 700, fontSize: 12, color: T.muted,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
    }}>{children}</div>
  )
}

export default function Preferences() {
  const navigate = useNavigate()
  const { preferences, setPreferences } = useAppState()

  // preferences 形如 { diets: [], allergies: [] }
  const diets = preferences.diets || []
  const allergies = preferences.allergies || []
  const goals = preferences.goals || []

  // 通用切换函数：某项在数组里就移除，不在就加入
  function toggle(key, value) {
    setPreferences(prev => {
      const list = prev[key] || []
      const next = list.includes(value)
        ? list.filter(x => x !== value)
        : [...list, value]
      return { ...prev, [key]: next }
    })
  }

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
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/privacy')} style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10,
          width: 34, height: 34, display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: T.ink, flexShrink: 0, marginTop: 3,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Your preferences</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Select anything that applies to you</div>
        </div>
      </div>

      <div style={{ padding: '4px 20px 0' }}>
        <SectionLabel>Dietary preferences</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DIETS.map(d => (
            <Chip key={d} label={d} active={diets.includes(d)} onClick={() => toggle('diets', d)} />
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <SectionLabel>Allergies</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALLERGIES.map(a => (
              <Chip key={a} label={a} active={allergies.includes(a)} onClick={() => toggle('allergies', a)} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <SectionLabel>Health goals (optional)</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOALS.map(g => (
              <Chip key={g} label={g} active={goals.includes(g)} onClick={() => toggle('goals', g)} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 20px 0', display: 'grid', gap: 10 }}>
        <button style={{ ...btnBase, background: T.green, color: '#fff' }}
          onClick={() => navigate('/capture')}>
          Save preferences
        </button>
        <button style={{ ...btnBase, background: 'transparent', color: T.green }}
          onClick={() => navigate('/capture')}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
