import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'
import { displayName, emojiForRecipe, rankRecipes, useFoodData } from '../data/foodData.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

const card = {
  background: '#fff', border: `1px dashed ${T.line}`, borderRadius: 14,
  padding: 24, textAlign: 'center', color: T.muted, fontSize: 14, lineHeight: 1.5,
}

export default function Recommendations() {
  const navigate = useNavigate()
  const { ingredients, preferences } = useAppState()
  const { data, error, loading } = useFoodData()

  const { ranked, excludedBy, consideredCount } = useMemo(() => {
    if (!data) return { ranked: [], excludedBy: new Map(), consideredCount: 0 }
    return rankRecipes(data.recipes, ingredients, preferences)
  }, [data, ingredients, preferences])

  const activePreferences = [...(preferences.diets || []), ...(preferences.allergies || [])]

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/quantity')} style={{
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
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Recommended for you</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            {loading
              ? 'Loading recipes…'
              : `${ranked.length} of ${consideredCount} recipes use what you have`}
          </div>
        </div>
      </div>

      {/* 生效中的偏好 */}
      {activePreferences.length > 0 && !loading && (
        <div style={{ padding: '0 20px 4px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {activePreferences.map((p) => (
            <span key={p} style={{
              background: T.greenSoft, color: T.green, fontWeight: 600,
              fontSize: 12, padding: '5px 10px', borderRadius: 999,
            }}>{p}</span>
          ))}
        </div>
      )}

      <div style={{ padding: '10px 20px 0', display: 'grid', gap: 14 }}>
        {error && (
          <div style={{ ...card, borderStyle: 'solid', background: T.tomatoSoft, color: T.tomato, fontWeight: 600 }}>
            Recipe data failed to load. Check your connection and try again.
          </div>
        )}

        {loading && <div style={card}>Loading the recipe collection…</div>}

        {/* 偏好把所有食谱都筛掉了 */}
        {!loading && !error && consideredCount === 0 && (
          <div style={card}>
            None of the 100 recipes match your preferences
            {excludedBy.size > 0 && ` (${[...excludedBy.keys()].join(', ')})`}.
            <div style={{ marginTop: 12 }}>
              <button onClick={() => navigate('/preferences')} style={{
                background: T.green, color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 14,
              }}>Adjust preferences</button>
            </div>
          </div>
        )}

        {/* 有食谱可选，但用户的食材对不上 */}
        {!loading && !error && consideredCount > 0 && ranked.length === 0 && (
          <div style={card}>
            No recipe uses the ingredients on your list yet. Add a few common
            staples such as egg, tomato, rice or pasta.
          </div>
        )}

        {ranked.map((r) => (
          <button key={r.recipe_id} onClick={() => navigate('/recipe/' + r.recipe_id)} style={{
            textAlign: 'left', background: '#fff', border: `1px solid ${T.line}`,
            borderRadius: 18, cursor: 'pointer', padding: 14, display: 'flex', gap: 14,
            fontFamily: 'inherit',
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: 14, background: T.greenSoft,
              display: 'grid', placeItems: 'center', fontSize: 30, flexShrink: 0,
            }}>
              {emojiForRecipe(r)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.ink }}>{r.recipe_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: 'monospace', fontSize: 12, color: T.green, fontWeight: 700,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.wattle }} />
                  {r.matchPercent}% match
                </span>
                <span style={{ fontSize: 12, color: T.muted }}>
                  · {r.meal_type} · {r.cuisine_style}
                </span>
              </div>
              {r.missing.length > 0 && (
                <div style={{ fontSize: 12, color: T.tomato, marginTop: 6 }}>
                  Missing: {r.missing.map(displayName).join(', ').toLowerCase()}
                </div>
              )}
              {r.dietary_tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {r.dietary_tags.map((t) => (
                    <span key={t} style={{
                      background: T.greenSoft, color: T.green, fontWeight: 600,
                      fontSize: 11, padding: '3px 8px', borderRadius: 999,
                    }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
