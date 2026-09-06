import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { displayName, rankRecipes, useFoodData } from '../data/foodData.js'
import { getRecipeImage } from '../data/recipeImages.js'

// 冷静专业配色：纯白底 + 中性灰 + 深绿点睛（近直角）
const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
  tomato: '#C6492B',
}

const emptyCard = {
  background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
  padding: 24, textAlign: 'center', color: T.sub, fontSize: 14, lineHeight: 1.5,
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
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '24px 20px 16px' }}>
        <button onClick={() => navigate('/quantity')} style={{
          background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2,
          width: 36, height: 36, display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: T.ink, flexShrink: 0, marginTop: 2,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.ink, letterSpacing: -0.6, lineHeight: 1.05 }}>
            Recipes
          </div>
          <div style={{ fontSize: 13, color: T.faint, marginTop: 6 }}>
            {loading
              ? 'Loading recipes…'
              : `${ranked.length} of ${consideredCount} use what you have`}
          </div>
        </div>
      </div>

      {/* 生效中的偏好 */}
      {activePreferences.length > 0 && !loading && (
        <div style={{ padding: '0 20px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {activePreferences.map((p) => (
            <span key={p} style={{
              background: T.fill, color: T.ink, fontWeight: 500,
              fontSize: 12, padding: '5px 10px', borderRadius: 2,
            }}>{p}</span>
          ))}
        </div>
      )}

      <div style={{ padding: '8px 20px 0', display: 'grid', gap: 20 }}>
        {error && (
          <div style={{ ...emptyCard, background: '#FBEAE5', color: T.tomato, fontWeight: 600 }}>
            Recipe data failed to load. Check your connection and try again.
          </div>
        )}

        {loading && <div style={emptyCard}>Loading the recipe collection…</div>}

        {!loading && !error && consideredCount === 0 && (
          <div style={emptyCard}>
            None of the 100 recipes match your preferences
            {excludedBy.size > 0 && ` (${[...excludedBy.keys()].join(', ')})`}.
            <div style={{ marginTop: 12 }}>
              <button onClick={() => navigate('/preferences')} style={{
                background: T.green, color: '#fff', border: 'none', borderRadius: 2,
                padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 14,
              }}>Adjust preferences</button>
            </div>
          </div>
        )}

        {!loading && !error && consideredCount > 0 && ranked.length === 0 && (
          <div style={emptyCard}>
            No recipe uses the ingredients on your list yet. Add a few common
            staples such as egg, tomato, rice or pasta.
          </div>
        )}

        {/* 卡片：直角、纯白、图块直角、冷静排版 */}
        {ranked.map((r) => {
          const img = getRecipeImage(r.recipe_name)
          return (
            <button key={r.recipe_id} onClick={() => navigate('/recipe/' + r.recipe_id)} style={{
              textAlign: 'left', background: T.bg, border: `1px solid ${T.line}`,
              borderRadius: 2, cursor: 'pointer', padding: 0, overflow: 'hidden',
              fontFamily: 'inherit', display: 'block', width: '100%',
            }}>
              {/* 图区（直角，配不上就纯深绿块） */}
              <div style={{
                height: 160, position: 'relative',
                display: 'flex', alignItems: 'flex-end', padding: 16,
                background: img
                  ? `linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0) 100%), url(${img})`
                  : T.green,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }}>
                <span style={{
                  position: 'absolute', top: 12, left: 12,
                  background: 'rgba(255,255,255,0.95)', color: T.ink, fontWeight: 600,
                  fontSize: 11, padding: '4px 9px', borderRadius: 2, letterSpacing: 0.2,
                  textTransform: 'capitalize',
                }}>
                  {r.meal_type}
                </span>
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'rgba(255,255,255,0.95)', color: T.ink, fontWeight: 700,
                  fontSize: 12, padding: '4px 9px', borderRadius: 2,
                  fontFamily: 'ui-monospace, monospace',
                }}>
                  {r.matchPercent}%
                </span>
                <div style={{
                  color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: 1.15,
                  letterSpacing: -0.3, maxWidth: '92%',
                }}>
                  {r.recipe_name}
                </div>
              </div>

              {/* 信息区 */}
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{
                  fontSize: 12, color: T.faint, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {r.cuisine_style}
                </div>

                {r.dietary_tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {r.dietary_tags.map((t) => (
                      <span key={t} style={{
                        background: T.fill, color: T.ink, fontWeight: 500,
                        fontSize: 11, padding: '4px 9px', borderRadius: 2,
                      }}>{t}</span>
                    ))}
                  </div>
                )}

                {r.missing.length > 0 && (
                  <div style={{
                    marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}`,
                    fontSize: 12.5, color: T.sub,
                  }}>
                    <span style={{ color: T.faint }}>Missing　</span>
                    {r.missing.map(displayName).join(', ').toLowerCase()}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}