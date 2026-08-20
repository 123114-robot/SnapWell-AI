import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

// 给常见食材配个 emoji（找不到就用通用的🥗）
const EMOJI = {
  apple: '🍎', banana: '🍌', orange: '🍊', tomato: '🍅', carrot: '🥕',
  broccoli: '🥦', milk: '🥛', egg: '🥚', bread: '🍞', cheese: '🧀',
  pasta: '🍝', rice: '🍚', chicken: '🍗', fish: '🐟', potato: '🥔',
  onion: '🧅', garlic: '🧄', lemon: '🍋', pizza: '🍕', cake: '🍰',
  cup: '🥤', bottle: '🍶', bowl: '🥣',
}
const emojiFor = (label) => EMOJI[String(label).toLowerCase()] || '🥗'

export default function DetectionResults() {
  const navigate = useNavigate()
  const { ingredients, setIngredients } = useAppState()

  // 删除一项
  function removeItem(id) {
    setIngredients(ingredients.filter(it => it.id !== id))
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
        <button onClick={() => navigate('/capture')} style={{
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
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Detected ingredients</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            Review and edit before we match recipes
          </div>
        </div>
      </div>

      {/* 食材列表 */}
      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 10 }}>
        {ingredients.length === 0 && (
          <div style={{
            background: '#fff', border: `1px dashed ${T.line}`, borderRadius: 14,
            padding: 24, textAlign: 'center', color: T.muted, fontSize: 14,
          }}>
            No ingredients detected. Go back and try another photo.
          </div>
        )}

        {ingredients.map(it => (
          <div key={it.id} style={{
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 14,
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 26 }}>{emojiFor(it.label)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: T.ink, textTransform: 'capitalize' }}>
                {it.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: it.source === 'manual' ? T.wattle : T.green,
                  background: it.source === 'manual' ? T.wattleSoft : T.greenSoft,
                  padding: '2px 7px', borderRadius: 999,
                }}>
                  {it.source === 'manual' ? 'Added' : 'Detected'}
                </span>
                {it.confidence != null && (
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: 'monospace' }}>
                    {Math.round(it.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => removeItem(it.id)} style={{
              width: 34, height: 34, borderRadius: 10, background: T.paper,
              border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: T.tomato,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* 继续按钮 */}
      <div style={{ padding: '20px 20px 0' }}>
        <button style={{ ...btnBase, background: T.green, color: '#fff' }}
          onClick={() => navigate('/confirm')}>
          Continue ({ingredients.length} items)
        </button>
      </div>
    </div>
  )
}