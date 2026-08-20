import { useNavigate, useParams } from 'react-router-dom'
import { RECIPES } from './Recommendations.jsx'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', tomato: '#D64525',
  muted: '#5E6E64', line: '#E4E0D6',
}

export default function NutritionInfo() {
  const navigate = useNavigate()
  const { id } = useParams()
  const recipe = RECIPES.find(r => r.id === id)

  if (!recipe) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: T.muted }}>
        Recipe not found.
        <div style={{ marginTop: 16 }}>
          <button onClick={() => navigate('/recommendations')} style={{
            background: T.green, color: '#fff', border: 'none', borderRadius: 12,
            padding: '10px 18px', cursor: 'pointer', fontWeight: 600,
          }}>Back to recipes</button>
        </div>
      </div>
    )
  }

  const n = recipe.nutrition
  const macros = [
    ['Calories', recipe.kcal, 'kcal'],
    ['Protein', n.protein, 'g'],
    ['Carbs', n.carbs, 'g'],
    ['Fat', n.fat, 'g'],
  ]
  const rows = [
    ['Protein', n.protein + ' g'],
    ['Carbohydrates', n.carbs + ' g'],
    ['Fat', n.fat + ' g'],
    ['Fibre', n.fibre + ' g'],
    ['Sodium', n.sodium + ' mg'],
  ]

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/recipe/' + recipe.id)} style={{
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
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Nutrition</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            {recipe.name} · per serving
          </div>
        </div>
      </div>

      {/* 四大营养概览（绿色卡片） */}
      <div style={{
        margin: '4px 20px 0', background: T.green, borderRadius: 18,
        padding: '16px 14px', display: 'flex', justifyContent: 'space-around',
      }}>
        {macros.map(([k, v, u]) => (
          <div key={k} style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.8 }}>{u}</div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3 }}>{k}</div>
          </div>
        ))}
      </div>

      {/* 详细营养表 */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{
          fontWeight: 700, fontSize: 12, color: T.muted,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
        }}>Detailed nutrition</div>
        <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{
              display: 'flex', justifyContent: 'space-between', padding: '12px 14px',
              borderTop: i ? `1px solid ${T.line}` : 'none',
            }}>
              <span style={{ fontSize: 14, color: T.ink }}>{k}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 14, color: T.ink }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 诚实声明横幅（论文核心卖点：营养有据可查，非 AI 瞎编） */}
      <div style={{
        margin: '18px 20px 0', background: T.greenSoft, borderRadius: 14,
        padding: 14, display: 'flex', gap: 10,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.green}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div style={{ fontSize: 12.5, color: T.green, lineHeight: 1.5 }}>
          Estimated from AUSNUT 2011–13 reference data, not AI-generated.
          For guidance only, not medical advice.
        </div>
      </div>

      {/* 完成，回首页 */}
      <div style={{ padding: '20px 20px 0' }}>
        <button onClick={() => navigate('/')} style={{
          width: '100%', background: T.green, color: '#fff', border: 'none',
          borderRadius: 14, padding: '14px 18px', fontFamily: 'inherit',
          fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}>
          Done
        </button>
      </div>
    </div>
  )
}