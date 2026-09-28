import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { isOnlineMode } from '../state/appMode.js'
import recommendationEngine from '../recommendation/recommendationEngine.js'
import { adaptRecommendationResult, displayIngredientLabel } from '../recommendation/recommendationAdapter.js'
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

function RecipeCard({ r, onOpen }) {
  const img = getRecipeImage(r.name)
  return (
    <button onClick={() => onOpen(r)} style={{
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
          {r.mealType}
        </span>
        <span style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,255,255,0.95)', color: T.ink, fontWeight: 700,
          fontSize: 12, padding: '4px 9px', borderRadius: 2,
          fontFamily: 'ui-monospace, monospace',
        }}>
          {r.displayCoverageScore}%
        </span>
        <div style={{
          color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: 1.15,
          letterSpacing: -0.3, maxWidth: '92%',
        }}>
          {r.name}
        </div>
      </div>

      {/* 信息区 */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: T.faint, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          <span>{r.cuisineStyle}</span>
          {/* Where the recipe came from. Every card carries it, so a generated
              recipe and one from the recipe book are never mistaken for each
              other — their coverage percentages are not the same measure. */}
          <span style={{
            background: T.green, color: '#fff', fontWeight: 700,
            fontSize: 10, padding: '2px 7px', borderRadius: 2, letterSpacing: 0.4,
          }}>
            {r.source === 'online' ? 'Online' : 'Local'}
          </span>
        </div>

        {r.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {r.tags.map((t) => (
              <span key={t} style={{
                background: T.fill, color: T.ink, fontWeight: 500,
                fontSize: 11, padding: '4px 9px', borderRadius: 2,
              }}>{t}</span>
            ))}
          </div>
        )}

        {r.missingIngredients.length > 0 && (
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}`,
            fontSize: 12.5, color: T.sub,
          }}>
            <span style={{ color: T.faint, marginRight: 6 }}>Missing</span>
            {r.missingIngredients.map(displayIngredientLabel).join(', ').toLowerCase()}
          </div>
        )}
      </div>
    </button>
  )
}

export default function Recommendations() {
  const navigate = useNavigate()
  const {
    ingredients,
    preferences,
    recommendationResult,
    setRecommendationResult,
    setSelectedRecipe,
    mode,
  } = useAppState()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRecommendations() {
      setStatus('loading')
      setError('')

      try {
        const result = await recommendationEngine(
          { ingredients, preferences },
          null,
          // Online mode shows generated recipes on their own, without the
          // local ones the engine would otherwise add behind them
          { allowOnline: isOnlineMode(mode), localTopUpCount: 0 },
        )
        if (cancelled) return
        setRecommendationResult(adaptRecommendationResult(result))
        setSelectedRecipe(null)
        setStatus('ready')
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load recommendations')
        setStatus('error')
      }
    }

    loadRecommendations()
    return () => { cancelled = true }
  }, [ingredients, preferences, mode, setRecommendationResult, setSelectedRecipe])

  const ranked = recommendationResult?.recommendations ?? []
  const visibleRecipes = ranked.filter((r) => r.coverageScore > 0 || r.source === 'online')
  const noConfirmedIngredients = (recommendationResult?.diagnostics?.confirmedIngredientCount ?? 0) === 0
  const onlineStatus = recommendationResult?.diagnostics?.onlineRecommendationStatus ?? null
  // Generated recipes the engine removed for conflicting with the user's settings
  const removedOnline = recommendationResult?.diagnostics?.removedOnlineRecipeCount ?? 0
  const activePreferences = [...(preferences.diets || []), ...(preferences.allergies || [])]

  function openRecipe(recipe) {
    setSelectedRecipe(recipe)
    navigate('/recipe/' + encodeURIComponent(recipe.id))
  }

  const subtitle = status === 'loading'
    ? 'Loading recipes…'
    : onlineStatus === 'success'
      ? 'Generated to match your ingredients'
      : `${visibleRecipes.length} match what you have`

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
            {subtitle}
          </div>
        </div>
      </div>

      {/* 生效中的偏好 */}
      {activePreferences.length > 0 && status === 'ready' && (
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
        {status === 'error' && (
          <div style={{ ...emptyCard, background: '#FBEAE5', color: T.tomato, fontWeight: 600 }}>
            Recommendations could not be loaded. {error}
          </div>
        )}

        {status === 'loading' && <div style={emptyCard}>Loading recommendations…</div>}

        {status === 'ready' && noConfirmedIngredients && (
          <div style={emptyCard}>
            Add at least one confirmed ingredient to calculate recipe recommendations.
            <div style={{ marginTop: 12 }}>
              <button onClick={() => navigate('/confirm')} style={{
                background: T.green, color: '#fff', border: 'none', borderRadius: 2,
                padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 14,
              }}>Add ingredients</button>
            </div>
          </div>
        )}

        {status === 'ready' && !noConfirmedIngredients && onlineStatus === 'success' && (
          <div style={{
            background: T.fill, border: `1px solid ${T.green}`, borderRadius: 2,
            padding: '12px 14px', fontSize: 12.5, color: T.ink, lineHeight: 1.5,
          }}>
            <strong style={{ color: T.green }}>Online recommendation.</strong>{' '}
            Recipes generated dynamically for your confirmed ingredients.
            {removedOnline > 0 && (
              <> {removedOnline === 1 ? 'One generated recipe was' : `${removedOnline} generated recipes were`} hidden
              because {removedOnline === 1 ? 'it conflicts' : 'they conflict'} with your allergy or diet settings.</>
            )}
          </div>
        )}

        {status === 'ready' && !noConfirmedIngredients && onlineStatus === 'filtered' && (
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: '12px 14px', fontSize: 12.5, color: T.sub, lineHeight: 1.5,
          }}>
            <strong style={{ color: T.ink }}>Generated recipes hidden.</strong>{' '}
            Every recipe generated for your list conflicted with your allergy or diet settings, so
            local recipe matches are shown instead.
          </div>
        )}

        {status === 'ready' && !noConfirmedIngredients && onlineStatus === 'failed' && (
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: '12px 14px', fontSize: 12.5, color: T.sub, lineHeight: 1.5,
          }}>
            <strong style={{ color: T.ink }}>Offline.</strong>{' '}
            Could not reach the online service — showing local recipe matches.
          </div>
        )}

        {status === 'ready' && !noConfirmedIngredients && onlineStatus === 'disabled'
          && recommendationResult?.fallbackRequired && (
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: '12px 14px', fontSize: 12.5, color: T.sub, lineHeight: 1.5,
          }}>
            <strong style={{ color: T.ink }}>Local mode.</strong>{' '}
            Showing matches from the built-in recipe book only. Online mode can generate
            recipes for ingredients the book does not cover well.
          </div>
        )}

        {status === 'ready' && !noConfirmedIngredients && visibleRecipes.length === 0 && (
          <div style={emptyCard}>
            No recipe uses the ingredients on your list yet. Add a few common
            staples such as egg, tomato, rice or pasta.
          </div>
        )}

        {/* 卡片：直角、纯白、图块直角、冷静排版 */}
        {status === 'ready' && !noConfirmedIngredients && visibleRecipes.map((r) => (
          <RecipeCard key={r.id} r={r} onOpen={openRecipe} />
        ))}
      </div>
    </div>
  )
}
