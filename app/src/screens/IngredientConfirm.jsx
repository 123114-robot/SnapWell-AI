import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { displayName } from '../ai/ingredientMatch.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

const EMOJI = {
  apple: '🍎', banana: '🍌', orange: '🍊', tomato: '🍅', carrot: '🥕',
  broccoli: '🥦', milk: '🥛', egg: '🥚', bread: '🍞', cheese: '🧀',
  pasta: '🍝', rice: '🍚', chicken: '🍗', fish: '🐟', potato: '🥔',
  onion: '🧅', garlic: '🧄', lemon: '🍋', pizza: '🍕', cake: '🍰',
}
const emojiFor = (label) => EMOJI[String(label).toLowerCase()] || '🥗'

export default function IngredientConfirm() {
  const navigate = useNavigate()
  const { ingredients, setIngredients, preferences } = useAppState()
  const [newName, setNewName] = useState('')

  function removeItem(id) {
    setIngredients(ingredients.filter(it => it.id !== id))
  }

  // 手动添加一个食材（source: 'manual'）
  function addItem() {
    const name = newName.trim().toLowerCase()
    if (!name) return
    const newItem = {
      id: Date.now(),           // 用时间戳做唯一 id
      label: name,
      confidence: null,          // 手动添加没有置信度
      quantity: 1,
      unit: 'piece',
      source: 'manual',
      bbox: null,
    }
    setIngredients([...ingredients, newItem])
    setNewName('')
  }

  const diets = (preferences.diets || [])
  const allergies = (preferences.allergies || [])

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', border: 'none', cursor: 'pointer', borderRadius: 14,
    fontFamily: 'inherit', fontWeight: 600, fontSize: 15, padding: '14px 18px',
  }

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/capture')} style={{
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
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Confirm ingredients</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            Add anything we missed, remove anything wrong
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 10 }}>
        {ingredients.map(it => (
          <div key={it.id} style={{
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 14,
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 26 }}>{emojiFor(it.label)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: T.ink }}>
                {displayName(it.label)}
                {(it.quantity || 1) > 1 && (
                  <span style={{ color: T.muted, fontWeight: 600 }}> ×{it.quantity}</span>
                )}
              </div>
              {it.productName && (
                <button type="button" onClick={() => navigate(`/product/${it.barcode}`, { state: { from: '/confirm' } })} style={{
                  display: 'block', background: 'none', border: 'none', padding: '3px 0 0',
                  color: T.muted, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', textAlign: 'left',
                }}>
                  {it.brand ? `${it.brand} · ` : ''}{it.productName}
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: it.source === 'manual' ? T.wattle : it.source === 'ocr' || it.source === 'product' ? T.ink : T.green,
                  background: it.source === 'manual' ? T.wattleSoft : it.source === 'ocr' || it.source === 'product' ? T.line : T.greenSoft,
                  padding: '2px 7px', borderRadius: 999,
                }}>
                  {it.source === 'manual' ? 'Added' : it.source === 'ocr' ? 'Label' : it.source === 'product' ? 'Product' : 'Detected'}
                </span>
                {it.safetyStatus && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                    color: it.safetyStatus === 'conflict' ? T.tomato : it.safetyStatus === 'trace' ? '#7A5200' : T.muted,
                    background: it.safetyStatus === 'conflict' ? T.tomatoSoft : it.safetyStatus === 'trace' ? T.wattleSoft : T.paper,
                  }}>
                    {it.safetyStatus === 'conflict' ? 'Allergy conflict' : it.safetyStatus === 'trace' ? 'May contain' : it.safetyStatus === 'unknown' ? 'Safety unknown' : 'Checked'}
                  </span>
                )}
                {it.confidence != null && (
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: 'monospace' }}>
                    {Math.round(it.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => removeItem(it.id)} style={{
              width: 34, height: 34, borderRadius: 10, background: T.paper,
              border: `1px solid ${T.line}`, display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: T.tomato,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* 手动添加 */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
            placeholder="Add an ingredient…"
            style={{
              flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 12,
              padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, outline: 'none',
            }}
          />
          <button onClick={addItem} style={{
            background: T.wattle, color: T.ink, border: 'none', borderRadius: 12,
            padding: '0 18px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            cursor: 'pointer',
          }}>Add</button>
        </div>

        <button
          onClick={() => navigate('/scan-package', { state: { from: '/confirm' } })}
          style={{
            ...btnBase, marginTop: 10, gap: 8, background: '#fff', color: T.green,
            border: `1.5px solid ${T.greenLine}`, padding: '12px 18px',
            boxSizing: 'border-box',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
            <path d="M8 9h8M8 12h8M8 15h5" />
          </svg>
          Scan a product barcode
        </button>

      </div>

      {/* 已选偏好提示 */}
      {(diets.length > 0 || allergies.length > 0) && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            fontWeight: 700, fontSize: 12, color: T.muted,
            textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
          }}>Applied preferences</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[...diets, ...allergies].map(p => (
              <span key={p} style={{
                background: T.greenSoft, color: T.green, fontWeight: 600,
                fontSize: 12, padding: '5px 10px', borderRadius: 999,
              }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* 继续 */}
      <div style={{ padding: '20px 20px 0' }}>
        <button style={{ ...btnBase, background: T.green, color: '#fff' }}
          onClick={() => navigate('/quantity')}>
          Continue
        </button>
      </div>
    </div>
  )
}
