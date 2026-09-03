import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'
import {
  displayName, emojiForIngredient, rankRecipes, scoreRecipe, storeLinks, useFoodData,
} from '../data/foodData.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

const PROVIDER_TONE = { coles: '#D64525', woolworths: '#1B4332' }

export default function MissingIngredients() {
  const navigate = useNavigate()
  const { ingredients, preferences } = useAppState()
  const { data, error, loading } = useFoodData()
  // 从食谱详情页进来时看的是那道菜；直接进来则取匹配度最高且还缺东西的一道
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
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate(-1)} style={{
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
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Missing ingredients</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            {loading ? 'Loading…' : target ? `To complete ${target.recipe.recipe_name}` : 'Nothing missing'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{
            background: T.tomatoSoft, borderRadius: 14, padding: '14px 16px',
            fontSize: 13, color: T.tomato, fontWeight: 600,
          }}>
            Recipe data failed to load.
          </div>
        </div>
      )}

      {!loading && !error && missing.length === 0 && (
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{
            background: '#fff', border: `1px dashed ${T.line}`, borderRadius: 14,
            padding: 24, textAlign: 'center', color: T.muted, fontSize: 14,
          }}>
            You have everything you need. Head back and start cooking.
          </div>
        </div>
      )}

      {/* 每个缺失食材一块，链接由数据层的模板生成 */}
      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 14 }}>
        {missing.map((label) => (
          <div key={label} style={{
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: T.wattleSoft,
                display: 'grid', placeItems: 'center', fontSize: 22,
              }}>{emojiForIngredient(label)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.ink }}>
                  {displayName(label)}
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>Find it near you</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {storeLinks(label, data?.providers).map((s) => (
                <a key={s.key} href={s.url} target="_blank" rel="noreferrer" style={{
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                  border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 14px',
                }}>
                  <div style={{
                    width: 4, height: 28, borderRadius: 4,
                    background: PROVIDER_TONE[s.key] || T.green,
                  }} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: T.ink }}>
                    Search on {s.name}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted}
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

      <div style={{ padding: '20px 20px 0' }}>
        <button onClick={() => navigate('/recommendations')} style={{
          width: '100%', background: 'transparent', color: T.green, border: 'none',
          borderRadius: 14, padding: '14px 18px', fontFamily: 'inherit',
          fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}>
          Back to recipes
        </button>
      </div>
    </div>
  )
}
