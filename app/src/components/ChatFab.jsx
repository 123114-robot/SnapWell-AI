import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import ChatDrawer from './ChatDrawer.jsx'
import { NAV_CONTENT_PAD } from './BottomNav.jsx'

const T = { green: '#1B4332', line: '#E5E5E7' }

/**
 * Screens where the assistant has something to be grounded in. The chat answers
 * only within recipes the local engine has already ranked, so an entry point on
 * a screen with no ranked recipes would open a chat with an empty whitelist —
 * a general-purpose chatbot, which is the thing this feature is not.
 */
function focusedRecipeIdFor(pathname) {
  const match = pathname.match(/^\/(?:recipe|nutrition)\/(.+)$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function isChatScreen(pathname) {
  return pathname === '/recommendations'
    || pathname.startsWith('/recipe/')
    || pathname.startsWith('/nutrition/')
}

export default function ChatFab() {
  const { pathname } = useLocation()
  const { ingredients, recommendationResult } = useAppState()
  const [open, setOpen] = useState(false)

  const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0
  const hasRecipes = (recommendationResult?.recommendations?.length ?? 0) > 0

  if (!isChatScreen(pathname) || !hasIngredients || !hasRecipes) return null

  return (
    <>
      {/* A full-width layer that catches no clicks, so the button sits on the
          content column's right edge on a wide screen and on the screen edge on
          a phone, without covering anything underneath. */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
        maxWidth: 430, margin: '0 auto', pointerEvents: 'none', height: 0,
      }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open recipe assistant"
          style={{
            pointerEvents: 'auto', position: 'absolute', right: 16,
            bottom: NAV_CONTENT_PAD + 16,
            width: 52, height: 52, borderRadius: 26,
            background: T.green, color: '#fff',
            border: `1px solid ${T.line}`, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 20px rgba(10,10,10,0.22)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
          </svg>
        </button>
      </div>

      <ChatDrawer
        open={open}
        onClose={() => setOpen(false)}
        focusedRecipeId={focusedRecipeIdFor(pathname)}
      />
    </>
  )
}
