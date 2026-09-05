import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { displayName } from '../ai/ingredientMatch.js'
import { emojiForIngredient } from '../data/foodData.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', tomato: '#D64525',
  muted: '#5E6E64', line: '#E4E0D6',
}

export default function QuantityAdjust() {
  const navigate = useNavigate()
  const { ingredients, setIngredients } = useAppState()
  const [serves, setServes] = useState(2)

  // 改某个食材的数量（不小于 0）
  function changeQty(id, delta) {
    setIngredients(ingredients.map(it =>
      it.id === id ? { ...it, quantity: Math.max(0, (it.quantity || 0) + delta) } : it
    ))
  }

  const stepBtn = {
    width: 30, height: 30, borderRadius: 8, background: T.greenSoft,
    border: 'none', color: T.green, display: 'grid', placeItems: 'center',
    cursor: 'pointer',
  }
  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', border: 'none', cursor: 'pointer', borderRadius: 14,
    fontFamily: 'inherit', fontWeight: 600, fontSize: 15, padding: '14px 18px',
  }
  const IconMinus = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
  const IconPlus = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/confirm')} style={{
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
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Quantity & servings</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            More accurate amounts improve nutrition estimates
          </div>
        </div>
      </div>

      {/* 用餐人数 */}
      <div style={{ padding: '4px 20px 0' }}>
        <div style={{
          fontWeight: 700, fontSize: 12, color: T.muted,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
        }}>Servings</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, background: '#fff',
          border: `1px solid ${T.line}`, borderRadius: 14, padding: '12px 16px', width: 'fit-content',
        }}>
          <button onClick={() => setServes(Math.max(1, serves - 1))}
            style={{ ...stepBtn, width: 36, height: 36 }}>{IconMinus}</button>
          <span style={{ fontSize: 22, fontWeight: 700, minWidth: 30, textAlign: 'center', color: T.ink }}>{serves}</span>
          <button onClick={() => setServes(serves + 1)}
            style={{ ...stepBtn, width: 36, height: 36 }}>{IconPlus}</button>
          <span style={{ fontSize: 14, color: T.muted }}>people</span>
        </div>
      </div>

      {/* 每种食材的数量 */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          fontWeight: 700, fontSize: 12, color: T.muted,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
        }}>Ingredient quantities</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {ingredients.map(it => (
            <div key={it.id} style={{
              background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>{emojiForIngredient(it.label)}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: T.ink }}>
                {displayName(it.label)}
              </span>
              <button onClick={() => changeQty(it.id, -1)} style={stepBtn}>{IconMinus}</button>
              <span style={{ fontFamily: 'monospace', fontSize: 14, minWidth: 30, textAlign: 'center', color: T.ink }}>
                {it.quantity || 0}
              </span>
              <button onClick={() => changeQty(it.id, 1)} style={stepBtn}>{IconPlus}</button>
              <span style={{ fontSize: 12, color: T.muted, minWidth: 40 }}>{it.unit || 'pcs'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 继续 */}
      <div style={{ padding: '22px 20px 0' }}>
        <button style={{ ...btnBase, background: T.green, color: '#fff' }}
          onClick={() => navigate('/recommendations')}>
          See recipes
        </button>
      </div>
    </div>
  )
}