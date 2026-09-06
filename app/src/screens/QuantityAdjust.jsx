import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { displayName } from '../ai/ingredientMatch.js'
import { emojiForIngredient } from '../data/foodData.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
}

export default function QuantityAdjust() {
  const navigate = useNavigate()
  const { ingredients, setIngredients } = useAppState()
  const [serves, setServes] = useState(2)

  function changeQty(id, delta) {
    setIngredients(ingredients.map(it =>
      it.id === id ? { ...it, quantity: Math.max(0, (it.quantity || 0) + delta) } : it
    ))
  }

  const stepBtn = {
    width: 32, height: 32, borderRadius: 2, background: T.fill,
    border: `1px solid ${T.line}`, color: T.ink, display: 'grid', placeItems: 'center',
    cursor: 'pointer',
  }
  const IconMinus = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
  const IconPlus = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/confirm')} style={{
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
          Quantity & servings
        </div>
        <p style={{ fontSize: 14, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
          More accurate amounts improve nutrition estimates.
        </p>
      </div>

      {/* 用餐人数 */}
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: T.faint,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
        }}>Servings</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, background: T.bg,
          border: `1px solid ${T.line}`, borderRadius: 2, padding: '12px 16px', width: 'fit-content',
        }}>
          <button onClick={() => setServes(Math.max(1, serves - 1))} style={{ ...stepBtn, width: 36, height: 36 }}>{IconMinus}</button>
          <span style={{ fontSize: 22, fontWeight: 700, minWidth: 30, textAlign: 'center', color: T.ink, fontFamily: 'ui-monospace, monospace' }}>{serves}</span>
          <button onClick={() => setServes(serves + 1)} style={{ ...stepBtn, width: 36, height: 36 }}>{IconPlus}</button>
          <span style={{ fontSize: 14, color: T.sub }}>people</span>
        </div>
      </div>

      {/* 每种食材数量 */}
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: T.faint,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
        }}>Ingredient quantities</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {ingredients.map(it => (
            <div key={it.id} style={{
              background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>{emojiForIngredient(it.label)}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: T.ink }}>
                {displayName(it.label)}
              </span>
              <button onClick={() => changeQty(it.id, -1)} style={stepBtn}>{IconMinus}</button>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, minWidth: 30, textAlign: 'center', color: T.ink }}>
                {it.quantity || 0}
              </span>
              <button onClick={() => changeQty(it.id, 1)} style={stepBtn}>{IconPlus}</button>
              <span style={{ fontSize: 12, color: T.faint, minWidth: 40 }}>{it.unit || 'pcs'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 继续 */}
      <div style={{ padding: '32px 20px 0' }}>
        <button onClick={() => navigate('/recommendations')} style={{
          width: '100%', background: T.green, color: '#fff', border: 'none', borderRadius: 2,
          padding: '16px 18px', fontFamily: 'inherit', fontWeight: 600, fontSize: 16, cursor: 'pointer',
        }}>
          See recipes
        </button>
      </div>
    </div>
  )
}