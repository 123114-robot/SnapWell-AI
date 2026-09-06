import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import {
  displayName, emojiForIngredient, rankRecipes, scoreRecipe, storeLinks, useFoodData,
} from '../data/foodData.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7', tomato: '#C6492B',
}

// 超市颜色（保留队友的品牌色语义）
const PROVIDER_TONE = { coles: '#C6492B', woolworths: '#1B4332' }

export default function MissingIngredients() {
  const navigate = useNavigate()
  const { ingredients, preferences } = useAppState()
  const { data, error, loading } = useFoodData()
  const requestedId = useLocation().state?.recipeId

  const target = useMemo(() => {
    if (!data) return null
    if (requestedId) {
      const recipe = data.recipesById.get(requestedId)
      if (recipe) return { recipe, ...scoreRecipe(recipe, ingredients) }
    }
    const { ranked } = rankRecipes(data.recipes, ingredients, preferences)
    const best = ranked.find((r) => r.missing.length > 0)
    return best ? { recipe: best, hit: best.hit, missing: best.missing } : null
  }, [data, requestedId, ingredients, preferences])

  const missing = target?.missing || []

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate(-1)} style={{
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
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: -0.7, lineHeight: 1.1 }}>
          Missing ingredients
        </div>
        <p style={{ fontSize: 14, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
          {loading ? 'Loading…' : target ? `To complete ${target.recipe.recipe_name}` : 'Nothing missing'}
        </p>
      </div>

      {error && (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{
            background: '#FBEAE5', borderRadius: 2, padding: '14px 16px',
            fontSize: 13, color: T.tomato, fontWeight: 600,
          }}>
            Recipe data failed to load.
          </div>
        </div>
      )}

      {!loading && !error && missing.length === 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: 24, textAlign: 'center', color: T.sub, fontSize: 14,
          }}>
            You have everything you need. Head back and start cooking.
          </div>
        </div>
      )}

      {/* 每个缺失食材一块 */}
      <div style={{ padding: '24px 20px 0', display: 'grid', gap: 12 }}>
        {missing.map((label) => (
          <div key={label} style={{
            background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2, padding: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 2, background: T.fill,
                display: 'grid', placeItems: 'center', fontSize: 22,
              }}>{emojiForIngredient(label)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.ink }}>
                  {displayName(label)}
                </div>
                <div style={{ fontSize: 12, color: T.faint }}>Find it near you</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {storeLinks(label, data?.providers).map((s) => (
                <a key={s.key} href={s.url} target="_blank" rel="noreferrer" style={{
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                  border: `1px solid ${T.line}`, borderRadius: 2, padding: '11px 14px',
                }}>
                  <div style={{
                    width: 3, height: 26, background: PROVIDER_TONE[s.key] || T.green,
                  }} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: T.ink }}>
                    Search on {s.name}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.faint}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '28px 20px 0' }}>
        <button onClick={() => navigate('/recommendations')} style={{
          width: '100%', background: T.bg, color: T.green, border: `1px solid ${T.line}`,
          borderRadius: 2, padding: '15px 18px', fontFamily: 'inherit',
          fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}>
          Back to recipes
        </button>
      </div>
    </div>
  )
}