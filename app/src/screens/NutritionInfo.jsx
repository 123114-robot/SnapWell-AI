import { useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', muted: '#5E6E64', line: '#E4E0D6',
}

export default function NutritionInfo() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { recommendationResult, selectedRecipe } = useAppState()
  const recipe = selectedRecipe?.id === id
    ? selectedRecipe
    : recommendationResult?.recommendations?.find(item => item.id === id)

  if (!recipe) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: T.muted }}>
        Recipe not found. Return to recommendations to select a current local result.
        <div style={{ marginTop: 16 }}>
          <button onClick={() => navigate('/recommendations')} style={{
            background: T.green, color: '#fff', border: 'none', borderRadius: 12,
            padding: '10px 18px', cursor: 'pointer', fontWeight: 600,
          }}>Back to recipes</button>
        </div>
      </div>
    )
  }

  const nutrition = recipe.nutrition
  const perServing = nutrition?.perServing
  const macros = nutrition?.available ? [
    ['Calories', Math.round(perServing.kcal), 'kcal'],
    ['Protein', perServing.protein.toFixed(1), 'g'],
    ['Carbs', perServing.carbs.toFixed(1), 'g'],
    ['Fat', perServing.fat.toFixed(1), 'g'],
  ] : []
  const rows = nutrition?.available ? [
    ['Protein', `${perServing.protein.toFixed(1)} g`],
    ['Carbohydrates', `${perServing.carbs.toFixed(1)} g`],
    ['Fat', `${perServing.fat.toFixed(1)} g`],
    ['Fibre', `${perServing.fibre.toFixed(1)} g`],
    ['Sodium', `${Math.round(perServing.sodium)} mg`],
  ] : []

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/recipe/' + encodeURIComponent(recipe.id))} style={{
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
            {recipe.name} · estimated per serving
          </div>
        </div>
      </div>

      {nutrition?.available ? (
        <>
          <div style={{
            margin: '4px 20px 0', background: T.green, borderRadius: 18,
            padding: '16px 14px', display: 'flex', justifyContent: 'space-around',
          }}>
            {macros.map(([label, value, unit]) => (
              <div key={label} style={{ textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.8 }}>{unit}</div>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '18px 20px 0' }}>
            <div style={{
              fontWeight: 700, fontSize: 12, color: T.muted,
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
            }}>Detailed nutrition</div>
            <div style={{
              background: '#fff', border: `1px solid ${T.line}`,
              borderRadius: 14, overflow: 'hidden',
            }}>
              {rows.map(([label, value], index) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '12px 14px',
                  borderTop: index ? `1px solid ${T.line}` : 'none',
                }}>
                  <span style={{ fontSize: 14, color: T.ink }}>{label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, color: T.ink }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 18,
            padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚖️</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: T.ink }}>
              Nutrition is unavailable for this recipe
            </div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.55, marginTop: 8 }}>
              {nutrition?.reason ?? 'The required portion or AUSNUT mapping data could not be loaded.'}
            </div>
          </div>
        </div>
      )}

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
          Estimated using standard ingredient portion weights and AUSNUT per-100g reference
          data{nutrition?.available ? ` for a ${nutrition.servings}-serving recipe` : ''}.
          Actual values may vary depending on ingredient size, brand, preparation method,
          and serving size.
        </div>
      </div>

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
