import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'
import recommendationEngine from '../recommendation/recommendationEngine.js'
import { adaptRecommendationResult, displayIngredientLabel } from '../recommendation/recommendationAdapter.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

export default function Recommendations() {
  const navigate = useNavigate()
  const {
    ingredients,
    preferences,
    recommendationResult,
    setRecommendationResult,
    setSelectedRecipe,
  } = useAppState()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRecommendations() {
      setStatus('loading')
      setError('')

      try {
        const result = await recommendationEngine({ ingredients, preferences })
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
  }, [ingredients, preferences, setRecommendationResult, setSelectedRecipe])

  const ranked = recommendationResult?.recommendations ?? []
  const visibleRecipes = ranked.filter(recipe => recipe.coverageScore > 0 || recipe.source === 'online')
  const noConfirmedIngredients = (recommendationResult?.diagnostics?.confirmedIngredientCount ?? 0) === 0
  const noEligibleRecipes = visibleRecipes.length === 0
  const onlineStatus = recommendationResult?.diagnostics?.onlineRecommendationStatus ?? null

  function openRecipe(recipe) {
    setSelectedRecipe(recipe)
    navigate('/recipe/' + encodeURIComponent(recipe.id))
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
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
            {onlineStatus === 'success' ? 'Generated to match your ingredients' : 'Ranked by ingredient coverage'}
          </div>
        </div>
      </div>

      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 14 }}>
        {status === 'loading' && (
          <MessageCard>Loading recommendations…</MessageCard>
        )}

        {status === 'error' && (
          <MessageCard tone={T.tomatoSoft} color={T.tomato}>
            Recommendations could not be loaded. {error}
          </MessageCard>
        )}

        {status === 'ready' && noConfirmedIngredients && (
          <MessageCard>
            Add at least one confirmed ingredient to calculate recipe recommendations.
          </MessageCard>
        )}

        {status === 'ready' && !noConfirmedIngredients && onlineStatus === 'success' && (
          <div style={{
            background: T.greenSoft, border: `1px solid ${T.green}`,
            borderRadius: 14, padding: 14, color: T.ink, fontSize: 13, lineHeight: 1.5,
          }}>
            <strong style={{ color: T.green }}>Online Recommendation.</strong> Recipes generated dynamically for your confirmed ingredients.
          </div>
        )}

        {status === 'ready' && !noConfirmedIngredients && onlineStatus === 'failed' && (
          <div style={{
            background: T.wattleSoft, border: `1px solid ${T.wattle}`,
            borderRadius: 14, padding: 14, color: T.ink, fontSize: 13, lineHeight: 1.5,
          }}>
            <strong>Unable to connect to online service.</strong> Showing local recipe matches.
          </div>
        )}

        {status === 'ready' && !noConfirmedIngredients && noEligibleRecipes && (
          <MessageCard>
            No eligible recipes match the confirmed ingredients and preferences.
          </MessageCard>
        )}

        {status === 'ready' && !noConfirmedIngredients && visibleRecipes.map(recipe => (
          <button key={recipe.id} onClick={() => openRecipe(recipe)} style={{
            textAlign: 'left', background: '#fff', border: `1px solid ${T.line}`,
            borderRadius: 18, cursor: 'pointer', padding: 14,
            display: 'flex', gap: 14,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 14, background: T.greenSoft,
              display: 'grid', placeItems: 'center', fontSize: 34, flexShrink: 0,
            }}>🍽️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.ink }}>{recipe.name}</div>
                {recipe.source === 'online' && (
                  <span style={{
                    background: T.greenSoft, color: T.green, fontSize: 10,
                    fontWeight: 700, padding: '2px 6px', borderRadius: 6, textTransform: 'uppercase',
                    letterSpacing: 0.4, flexShrink: 0,
                  }}>
                    Online Recommendation
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: 'monospace', fontSize: 12, color: T.green, fontWeight: 700,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.wattle }} />
                  {recipe.displayCoverageScore}% coverage
                </span>
                <span style={{ fontSize: 12, color: T.muted }}>
                  {recipe.mealType} · {recipe.cuisineStyle}
                </span>
              </div>
              {recipe.missingIngredients.length > 0 && (
                <div style={{ fontSize: 12, color: T.tomato, marginTop: 6 }}>
                  Missing: {recipe.missingIngredients.map(displayIngredientLabel).join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {recipe.tags.map(tag => (
                  <span key={tag} style={{
                    background: T.greenSoft, color: T.green, fontWeight: 600,
                    fontSize: 11, padding: '3px 8px', borderRadius: 999,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageCard({ children, tone = '#fff', color = T.muted }) {
  return (
    <div style={{
      background: tone, border: `1px dashed ${T.line}`, borderRadius: 14,
      padding: 24, textAlign: 'center', color, fontSize: 14,
    }}>
      {children}
    </div>
  )
}
