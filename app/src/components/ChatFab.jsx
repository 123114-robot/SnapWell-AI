import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { isOnlineMode, switchedToOnline } from '../state/appMode.js'
import { CHAT_PAGES, chatPageFor, chatStageFor, focusedRecipeIdFor, stageReady } from '../chat/chatStages.js'
import ChatDrawer from './ChatDrawer.jsx'
import { NAV_CONTENT_PAD } from './BottomNav.jsx'

const T = { green: '#1B4332', line: '#E5E5E7' }

const FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'

// Room below the page, so the last button on a screen — Continue, See recipes —
// can scroll clear of the chat button instead of ending up underneath it
const FAB_CLEARANCE = 68

const FAB_SIZE = 52

const HINT_STORAGE_KEY = 'SNAPWELL_CHAT_HINT_SEEN'
const HINT_DURATION_MS = 6000

// The entrance when Online mode is turned on: the button pops up, one ring
// spreads out from it, and the first-time hint follows once the button has landed
const POP_MS = 450
const RING_DELAY_MS = 350
const RING_MS = 900
const HINT_IN_MS = 250
const ENTRANCE_MS = RING_DELAY_MS + RING_MS

// Classes rather than inline animations, so reduced motion can switch them off
const ENTRANCE_CSS = `
@keyframes snapwell-fab-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.12); opacity: 1; }
  80% { transform: scale(0.96); }
  100% { transform: scale(1); }
}
@keyframes snapwell-fab-ring {
  from { transform: scale(1); opacity: 0.6; }
  to { transform: scale(1.9); opacity: 0; }
}
@keyframes snapwell-fab-hint {
  from { transform: translateY(6px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.snapwell-fab-pop { animation: snapwell-fab-pop ${POP_MS}ms ease-out both; }
.snapwell-fab-ring { animation: snapwell-fab-ring ${RING_MS}ms ease-out ${RING_DELAY_MS}ms forwards; }
.snapwell-fab-hint { animation: snapwell-fab-hint ${HINT_IN_MS}ms ease-out ${POP_MS}ms both; }
@media (prefers-reduced-motion: reduce) {
  .snapwell-fab-pop, .snapwell-fab-ring, .snapwell-fab-hint { animation: none; }
}
`

/**
 * The first-time hint beside the chat button is shown once per device. With
 * storage blocked it is treated as already seen: a hint that reappears on
 * every visit is worse than none.
 */
function hintAlreadySeen() {
  try {
    return window.localStorage.getItem(HINT_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function rememberHintSeen() {
  try {
    window.localStorage.setItem(HINT_STORAGE_KEY, '1')
  } catch {
    // Nothing to remember it in; it simply will not show again this session
  }
}

export default function ChatFab() {
  const { pathname } = useLocation()
  const { ingredients, recommendationResult, selectedRecipe, mode } = useAppState()
  const [open, setOpen] = useState(false)
  const [hintAvailable] = useState(() => !hintAlreadySeen())
  const [hintDone, setHintDone] = useState(false)

  // Turning Online mode on is when the button first appears, so it makes an
  // entrance then — not on a reload in Online mode, and not each time it comes
  // back between screens. A switch made on a screen without the assistant
  // keeps the entrance for the first screen that has one.
  const [seenMode, setSeenMode] = useState(mode)
  const [entrance, setEntrance] = useState(false)
  if (mode !== seenMode) {
    setSeenMode(mode)
    setEntrance(switchedToOnline(seenMode, mode))
  }

  // Only screens with something to stand on get an assistant, and only in
  // Online mode, because the assistant talks to Gemini; see chatStages
  const stage = chatStageFor(pathname)
  const page = chatPageFor(pathname)
  const available = isOnlineMode(mode) && Boolean(stage)
    && stageReady(stage, { ingredients, recommendationResult })

  const playEntrance = available && entrance

  // The hint belongs to the home screen, where someone who has just turned on
  // Online mode first meets the button
  const showHint = available && page === CHAT_PAGES.HOME && hintAvailable && !hintDone && !open

  useEffect(() => {
    if (!showHint) return undefined
    rememberHintSeen()
    const timer = setTimeout(() => setHintDone(true), HINT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [showHint])

  useEffect(() => {
    if (!playEntrance) return undefined
    const timer = setTimeout(() => setEntrance(false), ENTRANCE_MS)
    return () => clearTimeout(timer)
  }, [playEntrance])

  if (!available) return null

  function openChat() {
    setHintDone(true)
    setOpen(true)
  }

  return (
    <>
      {playEntrance && <style>{ENTRANCE_CSS}</style>}

      <div aria-hidden="true" style={{ height: FAB_CLEARANCE }} />

      {/* A full-width layer that catches no clicks, so the button sits on the
          content column's right edge on a wide screen and on the screen edge on
          a phone, without covering anything underneath. */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
        maxWidth: 430, margin: '0 auto', pointerEvents: 'none', height: 0,
      }}>
        {showHint && (
          <div role="status" className={playEntrance ? 'snapwell-fab-hint' : undefined} style={{
            pointerEvents: 'auto', position: 'absolute', right: 16,
            bottom: NAV_CONTENT_PAD + 16 + FAB_SIZE + 12,
            display: 'flex', alignItems: 'center', gap: 4,
            background: T.green, color: '#fff', borderRadius: 2,
            padding: '8px 6px 8px 12px', boxShadow: '0 6px 20px rgba(10,10,10,0.22)',
            fontFamily: FONT, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            <button type="button" onClick={openChat} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: '#fff', font: 'inherit',
            }}>
              Ask me how SnapWell works
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => setHintDone(true)} style={{
              background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer',
              color: 'rgba(255,255,255,0.8)', fontSize: 16, lineHeight: 1,
            }}>
              ×
            </button>
            <span aria-hidden="true" style={{
              position: 'absolute', right: FAB_SIZE / 2 - 6, bottom: -6,
              width: 12, height: 12, background: T.green, transform: 'rotate(45deg)',
            }} />
          </div>
        )}

        <button
          type="button"
          onClick={openChat}
          aria-label="Open SnapWell assistant"
          className={playEntrance ? 'snapwell-fab-pop' : undefined}
          style={{
            pointerEvents: 'auto', position: 'absolute', right: 16,
            bottom: NAV_CONTENT_PAD + 16,
            width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
            background: T.green, color: '#fff',
            border: `1px solid ${T.line}`, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 6px 20px rgba(10,10,10,0.22)',
          }}
        >
          {playEntrance && (
            <span aria-hidden="true" className="snapwell-fab-ring" style={{
              position: 'absolute', inset: -1, borderRadius: '50%',
              border: `2px solid ${T.green}`, opacity: 0, pointerEvents: 'none',
            }} />
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
          </svg>
        </button>
      </div>

      <ChatDrawer
        open={open}
        onClose={() => setOpen(false)}
        stage={stage}
        page={page}
        focusedRecipeId={focusedRecipeIdFor(pathname, selectedRecipe)}
      />
    </>
  )
}
