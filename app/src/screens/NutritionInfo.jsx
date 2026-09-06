import { useNavigate, useParams } from 'react-router-dom'
import { displayName, emojiForIngredient, useFoodData } from '../data/foodData.js'

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

const round = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null)

export default function NutritionInfo() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data, error, loading } = useFoodData()

  if (loading) return <Notice>Loading nutrition…</Notice>
  if (error) return <Notice>Nutrition data failed to load.</Notice>

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

  const rows = recipe.ingredients
    .map((label) => data.nutritionByLabel.get(label))
    .filter(Boolean)

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/recipe/' + recipe.recipe_id)} style={{
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
          {recipe.recipe_name} · {data.nutritionBasis}
        </p>
      </div>

      {/* 每种食材一张卡（数值直接来自 AUSNUT，不做任何加总 —— 逻辑不动） */}
      <div style={{ padding: '24px 20px 0', display: 'grid', gap: 10 }}>
        {rows.map((item) => {
          const n = item.nutrition
          return (
            <div key={item.label} style={{
              background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{emojiForIngredient(item.label)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: T.ink }}>
                    {displayName(item.label)}
                  </div>
                  <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>
                    {item.ausnut_food_name}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 17, color: T.ink, fontFamily: 'ui-monospace, monospace' }}>
                    {round(n.energy_kcal)}
                  </div>
                  <div style={{ fontSize: 10, color: T.faint, letterSpacing: 0.4 }}>KCAL</div>
                </div>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
                marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}`,
              }}>
                {[
                  ['Protein', n.protein_g, 'g'],
                  ['Carbs', n.carbs_g, 'g'],
                  ['Fat', n.fat_g, 'g'],
                  ['Fibre', n.fibre_g, 'g'],
                ].map(([k, v, unit]) => (
                  <div key={k} style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.ink, fontFamily: 'ui-monospace, monospace' }}>
                      {round(v)}<span style={{ fontSize: 10, color: T.faint }}>{unit}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.faint, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k}</div>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 10, fontSize: 11, color: T.faint, fontFamily: 'ui-monospace, monospace',
              }}>
                <span>sugars {round(n.sugars_g)} g · sodium {round(n.sodium_mg)} mg</span>
                <span>{item.ausnut_public_food_key}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 诚实声明：措辞一字不动，只改外观 */}
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
          Values are shown for each ingredient {data.nutritionBasis}, taken from{' '}
          {data.attribution.dataset}. The recipe collection does not record how much
          of each ingredient a serving uses, so no per-serving total is calculated
          here rather than estimated. For guidance only, not medical advice.
        </div>
      </div>

      {/* AUSNUT 署名（措辞不动） */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ fontSize: 11, color: T.faint, lineHeight: 1.6 }}>
          Food and nutrient data derived from {data.attribution.dataset},{' '}
          {data.attribution.provider}, licensed under {data.attribution.license}.
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