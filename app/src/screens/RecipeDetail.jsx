import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import {
  displayName, emojiForIngredient, scoreRecipe, useFoodData,
} from '../data/foodData.js'
import { getRecipeImage } from '../data/recipeImages.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7', tomato: '#C6492B',
}

function Notice({ children }) {
  return (
    <div style={{
      padding: 40, textAlign: 'center', color: T.sub,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    }}>
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
            background: T.green, color: '#fff', border: 'none', borderRadius: 2,
            padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
          }}>Back to recipes</button>
        </div>
      </Notice>
    )
  }

  const { hit, missing } = scoreRecipe(recipe, ingredients)
  const img = getRecipeImage(recipe.recipe_name)

  const facts = [
    ['Meal', recipe.meal_type],
    ['Cuisine', recipe.cuisine_style],
    ['Ingredients', String(recipe.ingredients.length)],
  ]

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部图区（直角，有图用图，无图用深绿块） */}
      <div style={{
        position: 'relative', height: 200,
        background: img
          ? `linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 55%), url(${img})`
          : T.green,
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <button onClick={() => navigate('/recommendations')} style={{
          position: 'absolute', left: 16, top: 16, width: 36, height: 36,
          borderRadius: 2, background: 'rgba(255,255,255,.95)', border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.ink,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button onClick={() => setSaved(!saved)} style={{
          position: 'absolute', right: 16, top: 16, width: 36, height: 36,
          borderRadius: 2, background: 'rgba(255,255,255,.95)', border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          color: saved ? T.tomato : T.ink,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? T.tomato : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: T.ink, letterSpacing: -0.5, lineHeight: 1.15 }}>
          {recipe.recipe_name}
        </div>

        {recipe.dietary_tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {recipe.dietary_tags.map((t) => (
              <span key={t} style={{
                background: T.fill, color: T.ink, fontWeight: 500,
                fontSize: 12, padding: '4px 9px', borderRadius: 2,
              }}>{t}</span>
            ))}
          </div>
        )}

        {/* 数据条 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{
              flex: 1, minWidth: 0, background: T.bg, border: `1px solid ${T.line}`,
              borderRadius: 2, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{
                fontWeight: 700, fontSize: 14, color: T.ink, textTransform: 'capitalize',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{v}</div>
              <div style={{ fontSize: 11, color: T.faint, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k}</div>
            </div>
          ))}
        </div>

        {/* 食材：有的打勾，缺的标叉 */}
        <div style={{
          fontSize: 12, fontWeight: 600, color: T.faint,
          textTransform: 'uppercase', letterSpacing: 0.6, margin: '24px 0 12px',
        }}>Ingredients</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {recipe.ingredients.map((n) => {
            const has = hit.includes(n)
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{emojiForIngredient(n)}</span>
                <span style={{ color: has ? T.green : T.tomato, display: 'grid', placeItems: 'center' }}>
                  {has
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </span>
                <span style={{ color: has ? T.ink : T.faint }}>{displayName(n)}</span>
              </div>
            )
          })}
        </div>

        {missing.length > 0 && (
          <button onClick={() => navigate('/missing', { state: { recipeId: recipe.recipe_id } })} style={{
            width: '100%', marginTop: 16, background: T.bg, color: T.tomato,
            border: `1px solid ${T.tomato}`, borderRadius: 2, padding: '13px',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            You're missing {missing.length} item{missing.length > 1 ? 's' : ''} — see where to buy
          </button>
        )}

        {/* 步骤 */}
        <div style={{
          fontSize: 12, fontWeight: 600, color: T.faint,
          textTransform: 'uppercase', letterSpacing: 0.6, margin: '24px 0 12px',
        }}>Method</div>
        <div style={{ display: 'grid', gap: 14 }}>
          {recipe.steps.map((s, i) => (
            <div key={s} style={{ display: 'flex', gap: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 2, background: T.green,
                color: '#fff', fontFamily: 'ui-monospace, monospace', fontSize: 12,
                display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1,
              }}>{i + 1}</div>
              <span style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28 }}>
          <button onClick={() => navigate('/nutrition/' + recipe.recipe_id)} style={{
            width: '100%', background: T.green, color: '#fff', border: 'none',
            borderRadius: 2, padding: '16px 18px', fontFamily: 'inherit',
            fontWeight: 600, fontSize: 16, cursor: 'pointer',
          }}>
            View nutrition
          </button>
        </div>
      </div>
    </div>
  )
}