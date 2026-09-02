import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'
import { loadMissingIngredientLinks } from '../recommendation/foodDataService.js'
import { createMissingIngredientLinks, displayIngredientLabel } from '../recommendation/recommendationAdapter.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  wattleSoft: '#FBEECB', tomato: '#D64525',
  muted: '#5E6E64', line: '#E4E0D6',
}

const PROVIDER_TONES = {
  coles: T.tomato,
  woolworths: T.green,
}

export default function MissingIngredients() {
  const navigate = useNavigate()
  const { selectedRecipe } = useAppState()
  const [linkData, setLinkData] = useState(null)
  const [linkError, setLinkError] = useState('')
  const missing = selectedRecipe?.missingIngredients ?? []

  useEffect(() => {
    let cancelled = false

    loadMissingIngredientLinks()
      .then(data => {
        if (!cancelled) setLinkData(data)
      })
      .catch(error => {
        if (!cancelled) {
          setLinkError(error instanceof Error ? error.message : 'Shopping links are unavailable')
        }
      })

    return () => { cancelled = true }
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate(selectedRecipe ? `/recipe/${selectedRecipe.id}` : '/recommendations')} style={{
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
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Missing ingredients</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            {selectedRecipe ? `To complete ${selectedRecipe.name}` : 'Select a recommendation first'}
          </div>
        </div>
      </div>

      {!selectedRecipe && (
        <StatusCard>Select a recipe from the recommendation list to see its missing ingredients.</StatusCard>
      )}

      {selectedRecipe && missing.length === 0 && (
        <StatusCard>You have everything this recipe requires.</StatusCard>
      )}

      {linkError && missing.length > 0 && (
        <StatusCard>Shopping links could not be loaded. {linkError}</StatusCard>
      )}

      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 14 }}>
        {missing.map(item => {
          const storeLinks = createMissingIngredientLinks(item, linkData)
          return (
            <div key={item} style={{
              background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: T.wattleSoft,
                  display: 'grid', placeItems: 'center', fontSize: 22,
                }}>🛒</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, textTransform: 'capitalize' }}>
                    {displayIngredientLabel(item)}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted }}>Find it near you</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {!linkData && !linkError && (
                  <div style={{ fontSize: 12, color: T.muted }}>Loading store links…</div>
                )}
                {storeLinks.map(link => (
                  <a key={link.id} href={link.url} target="_blank" rel="noreferrer" style={{
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                    border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 14px',
                  }}>
                    <div style={{
                      width: 4, height: 28, borderRadius: 4,
                      background: PROVIDER_TONES[link.id] ?? T.muted,
                    }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: T.ink }}>
                      Search on {link.store}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <button onClick={() => navigate('/recommendations')} style={{
          width: '100%', background: 'transparent', color: T.green, border: 'none',
          borderRadius: 14, padding: '14px 18px', fontFamily: 'inherit',
          fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}>
          Back to recipes
        </button>
      </div>
    </div>
  )
}

function StatusCard({ children }) {
  return (
    <div style={{ padding: '4px 20px 0' }}>
      <div style={{
        background: '#fff', border: `1px dashed ${T.line}`, borderRadius: 14,
        padding: 24, textAlign: 'center', color: T.muted, fontSize: 14,
      }}>
        {children}
      </div>
    </div>
  )
}
