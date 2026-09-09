import { useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { displayIngredientLabel } from '../recommendation/recommendationAdapter.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
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

export default function NutritionInfo() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { recommendationResult, selectedRecipe } = useAppState()

  const recipe = selectedRecipe?.id === id
    ? selectedRecipe
    : recommendationResult?.recommendations?.find((item) => item.id === id)

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
  // An AI recipe can name food the dataset does not cover. The numbers then
  // describe only part of the plate, and saying which part is missing is the
  // difference between an estimate and a wrong number. The two reasons are
  // kept apart: one has no AUSNUT entry at all, the other has one but no way
  // to turn the amount into grams.
  const names = (labels) => (labels ?? []).map(displayIngredientLabel).filter(Boolean)
  const exclusions = (nutrition?.available && nutrition.partial)
    ? [
      ['no AUSNUT match', names(nutrition.unmatchedIngredients)],
      ['no portion estimate', names(nutrition.unestimatedIngredients)],
    ].filter(([, labels]) => labels.length > 0)
    : []
  const excludedCount = exclusions.reduce((sum, [, labels]) => sum + labels.length, 0)

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/recipe/' + encodeURIComponent(recipe.id))} style={{
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
          Nutrition
        </div>
        <p style={{ fontSize: 14, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
          {recipe.name} · estimated per serving
        </p>
      </div>

      {nutrition?.available ? (
        <>
          {/* 每份宏量：直角四宫格 */}
          <div style={{ padding: '24px 20px 0', display: 'flex', gap: 8 }}>
            {macros.map(([label, value, unit]) => (
              <div key={label} style={{
                flex: 1, minWidth: 0, background: T.bg, border: `1px solid ${T.line}`,
                borderRadius: 2, padding: '14px 6px', textAlign: 'center',
              }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: T.ink, fontFamily: 'ui-monospace, monospace' }}>
                  {value}
                </div>
                <div style={{ fontSize: 10, color: T.faint, letterSpacing: 0.4 }}>{unit.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* 明细 */}
          <div style={{ padding: '24px 20px 0' }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: T.faint,
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
            }}>Detailed nutrition</div>
            <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2, overflow: 'hidden' }}>
              {rows.map(([label, value], index) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '12px 14px',
                  borderTop: index ? `1px solid ${T.line}` : 'none',
                }}>
                  <span style={{ fontSize: 14, color: T.ink }}>{label}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: T.ink }}>{value}</span>
                </div>
              ))}
            </div>

            {excludedCount > 0 && (
              <div style={{
                marginTop: 12, background: T.fill, border: `1px solid ${T.line}`,
                borderRadius: 2, padding: '12px 14px',
                fontSize: 12.5, color: T.sub, lineHeight: 1.55,
              }}>
                <strong style={{ color: T.ink, fontWeight: 600 }}>
                  Excludes {excludedCount} ingredient{excludedCount === 1 ? '' : 's'}
                </strong>
                {exclusions.map(([reason, labels]) => (
                  <div key={reason} style={{ marginTop: 4 }}>
                    {labels.join(', ')} — {reason}
                  </div>
                ))}
                <div style={{ marginTop: 6 }}>
                  The totals above cover the rest of the recipe only.
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: 24, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚖️</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: T.ink }}>
              Nutrition is unavailable for this recipe
            </div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, marginTop: 8 }}>
              {nutrition?.reason ?? 'The required portion or AUSNUT mapping data could not be loaded.'}
            </div>
          </div>
        </div>
      )}

      {/* 诚实声明 */}
      <div style={{
        margin: '24px 20px 0', background: T.fill, borderRadius: 2,
        padding: 16, display: 'flex', gap: 12,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.green}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55 }}>
          Estimated using standard ingredient portion weights and AUSNUT per-100g reference
          data{nutrition?.available
            ? ` for ${nutrition.servingsAssumed ? 'an assumed ' : 'a '}${nutrition.servings}-serving recipe`
            : ''}. Actual values may vary with ingredient size, brand, preparation and serving
          size. For guidance only, not medical advice.
        </div>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/')} style={{
          width: '100%', background: T.green, color: '#fff', border: 'none',
          borderRadius: 2, padding: '16px 18px', fontFamily: 'inherit',
          fontWeight: 600, fontSize: 16, cursor: 'pointer',
        }}>
          Done
        </button>
      </div>
    </div>
  )
}
