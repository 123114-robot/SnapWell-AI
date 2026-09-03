import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'
import {
  displayName, emojiForIngredient, emojiForRecipe, scoreRecipe, useFoodData,
} from '../data/foodData.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', tomato: '#D64525',
  muted: '#5E6E64', line: '#E4E0D6',
}

function Notice({ children }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: T.muted }}>
      {children}
    </div>
  )
}

export default function RecipeDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { ingredients } = useAppState()
  const { data, error, loading } = useFoodData()
  const [saved, setSaved] = useState(false)

  if (loading) return <Notice>Loading recipe…</Notice>
  if (error) return <Notice>Recipe data failed to load.</Notice>

  const recipe = data.recipesById.get(id)
  if (!recipe) {
    return (
      <Notice>
        Recipe not found.
        <div style={{ marginTop: 16 }}>
          <button onClick={() => navigate('/recommendations')} style={{
            background: T.green, color: '#fff', border: 'none', borderRadius: 12,
            padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
          }}>Back to recipes</button>
        </div>
      </Notice>
    )
  }

  const { hit, missing } = scoreRecipe(recipe, ingredients)

  // 数据集没有烹饪时间和份量，所以这里只展示数据里真实存在的字段
  const facts = [
    ['Meal', recipe.meal_type],
    ['Cuisine', recipe.cuisine_style],
    ['Ingredients', String(recipe.ingredients.length)],
  ]

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{
        position: 'relative', height: 150, background: T.greenSoft,
        display: 'grid', placeItems: 'center', fontSize: 64,
      }}>
        {emojiForRecipe(recipe)}
        <button onClick={() => navigate('/recommendations')} style={{
          position: 'absolute', left: 16, top: 16, width: 36, height: 36,
          borderRadius: '50%', background: 'rgba(255,255,255,.92)', border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.ink,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button onClick={() => setSaved(!saved)} style={{
          position: 'absolute', right: 16, top: 16, width: 36, height: 36,
          borderRadius: '50%', background: 'rgba(255,255,255,.92)', border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          color: saved ? T.tomato : T.ink,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? T.tomato : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.ink }}>{recipe.recipe_name}</div>

        {recipe.dietary_tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {recipe.dietary_tags.map((t) => (
              <span key={t} style={{
                background: T.greenSoft, color: T.green, fontWeight: 600,
                fontSize: 12, padding: '4px 10px', borderRadius: 999,
              }}>{t}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{
              flex: 1, minWidth: 0, background: '#fff', border: `1px solid ${T.line}`,
              borderRadius: 12, padding: '10px 8px', textAlign: 'center',
            }}>
              <div style={{
                fontWeight: 700, fontSize: 14, color: T.ink,
                textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{v}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{k}</div>
            </div>
          ))}
        </div>

        {/* 食材：有的打勾，缺的标红 */}
        <div style={{ fontWeight: 700, fontSize: 13, color: T.ink, margin: '18px 0 8px' }}>
          Ingredients
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {recipe.ingredients.map((n) => {
            const has = hit.includes(n)
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{emojiForIngredient(n)}</span>
                <span style={{ color: has ? T.green : T.tomato, display: 'grid', placeItems: 'center' }}>
                  {has
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </span>
                <span style={{ color: has ? T.ink : T.muted }}>{displayName(n)}</span>
              </div>
            )
          })}
        </div>

        {missing.length > 0 && (
          <button onClick={() => navigate('/missing', { state: { recipeId: recipe.recipe_id } })} style={{
            width: '100%', marginTop: 14, background: '#fff', color: T.tomato,
            border: `1.5px solid ${T.tomato}`, borderRadius: 12, padding: '12px',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            boxSizing: 'border-box',
          }}>
            You&rsquo;re missing {missing.length} item{missing.length > 1 ? 's' : ''} — see where to buy
          </button>
        )}

        {/* 步骤 */}
        <div style={{ fontWeight: 700, fontSize: 13, color: T.ink, margin: '20px 0 8px' }}>Method</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {recipe.steps.map((s, i) => (
            <div key={s} style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: T.green,
                color: '#fff', fontFamily: 'monospace', fontSize: 12,
                display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1,
              }}>{i + 1}</div>
              <span style={{ fontSize: 14, color: T.ink, lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <button onClick={() => navigate('/nutrition/' + recipe.recipe_id)} style={{
            width: '100%', background: T.green, color: '#fff', border: 'none',
            borderRadius: 14, padding: '14px 18px', fontFamily: 'inherit',
            fontWeight: 600, fontSize: 15, cursor: 'pointer', boxSizing: 'border-box',
          }}>
            View nutrition
          </button>
        </div>
      </div>
    </div>
  )
}
