import { useEffect, useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { APP_MODES, hasOnlineConsent, isOnlineMode, saveOnlineConsent } from '../state/appMode.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
}

const FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'

/**
 * Screens that show one recipe out of the cached list. Switching mode clears
 * that list, so staying on one of these would land on "recipe not found".
 */
const RECIPE_SCREENS = /^\/(?:recipe|nutrition)\/|^\/missing$/

const MODE_COPY = {
  [APP_MODES.LOCAL]: {
    label: 'Local mode',
    summary: 'Everything runs on your device.',
  },
  [APP_MODES.ONLINE]: {
    label: 'Online mode',
    summary: 'Chat with AI and get recipe recommendations.',
  },
}

function DeviceIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  )
}

function SparkIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
    </svg>
  )
}

function ModeIcon({ mode, size }) {
  return isOnlineMode(mode) ? <SparkIcon size={size} /> : <DeviceIcon size={size} />
}

/**
 * One switching rule for every entry point. The first move to Online mode
 * shows a short notice, because that is when data starts leaving the device;
 * once it has been accepted, switching either way is instant.
 */
function useModeChoice() {
  const { mode, setMode } = useAppState()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [noticeOpen, setNoticeOpen] = useState(false)

  function apply(next) {
    setNoticeOpen(false)
    if (next === mode) return
    setMode(next)
    if (RECIPE_SCREENS.test(pathname)) navigate('/recommendations')
  }

  function needsNotice(next) {
    return next !== mode && isOnlineMode(next) && !hasOnlineConsent()
  }

  function choose(next) {
    if (next === mode) return
    if (needsNotice(next)) setNoticeOpen(true)
    else apply(next)
  }

  return {
    mode,
    choose,
    needsNotice,
    noticeOpen,
    accept: () => {
      saveOnlineConsent()
      apply(APP_MODES.ONLINE)
    },
    cancel: () => setNoticeOpen(false),
    learnMore: () => {
      setNoticeOpen(false)
      navigate('/privacy')
    },
  }
}

function Sheet({ labelledBy, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(10,10,10,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT,
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
        style={{
          background: T.bg, width: '100%', maxWidth: 430, maxHeight: '88vh', overflowY: 'auto',
          boxSizing: 'border-box', borderTop: `1px solid ${T.line}`,
          padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function OnlineNotice({ onAccept, onCancel, onLearnMore }) {
  const titleId = useId()

  return (
    <Sheet labelledBy={titleId} onClose={onCancel}>
      <h2 id={titleId} style={{ margin: 0, fontSize: 21, fontWeight: 700, color: T.ink, letterSpacing: -0.4 }}>
        Turn on Online mode?
      </h2>
      <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.55, margin: '10px 0 0' }}>
        Your ingredient list, preferences and chat messages are sent to Google Gemini.
        Photos always stay on your device.{' '}
        <button type="button" onClick={onLearnMore} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: T.green, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600,
        }}>
          Learn more
        </button>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={onCancel} style={{
          background: T.bg, color: T.ink, border: `1px solid ${T.line}`, borderRadius: 2,
          padding: '13px 12px', fontFamily: FONT, fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}>
          Not now
        </button>
        <button type="button" onClick={onAccept} style={{
          background: T.green, color: '#fff', border: 'none', borderRadius: 2,
          padding: '13px 12px', fontFamily: FONT, fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}>
          Turn on
        </button>
      </div>
    </Sheet>
  )
}

function ModeOptions({ mode, onChoose }) {
  return (
    <div role="radiogroup" aria-label="App mode" style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10,
    }}>
      {[APP_MODES.LOCAL, APP_MODES.ONLINE].map((option) => {
        const active = option === mode
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChoose(option)}
            style={{
              textAlign: 'left', background: T.bg, borderRadius: 2, padding: 14,
              border: `1.5px solid ${active ? T.green : T.line}`,
              cursor: 'pointer', fontFamily: FONT,
              display: 'grid', gap: 8, alignContent: 'start',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                width: 28, height: 28, borderRadius: 2, display: 'grid', placeItems: 'center',
                background: active ? T.green : T.fill, color: active ? '#fff' : T.green,
              }}>
                <ModeIcon mode={option} size={15} />
              </span>
              {active && (
                <span style={{
                  fontSize: 10.5, fontWeight: 700, color: T.green,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>On</span>
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: T.ink }}>{MODE_COPY[option].label}</div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45 }}>{MODE_COPY[option].summary}</div>
          </button>
        )
      })}
    </div>
  )
}

/** The picker on the home screen. */
export function ModeSelector() {
  const choice = useModeChoice()

  return (
    <>
      <ModeOptions mode={choice.mode} onChoose={choice.choose} />
      {choice.noticeOpen && (
        <OnlineNotice onAccept={choice.accept} onCancel={choice.cancel} onLearnMore={choice.learnMore} />
      )}
    </>
  )
}

/**
 * The always-visible mode marker. It is a button, so the mode can be changed
 * from any screen rather than only from home.
 */
export function ModeBadge() {
  const choice = useModeChoice()
  const [menuOpen, setMenuOpen] = useState(false)
  const titleId = useId()
  const online = isOnlineMode(choice.mode)

  function chooseFromMenu(next) {
    // When the notice is about to show, the menu stays underneath it, so
    // "Not now" returns to the choice instead of dropping back on the page
    if (!choice.needsNotice(next)) setMenuOpen(false)
    choice.choose(next)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={`${MODE_COPY[choice.mode].label}. Change mode`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
          background: online ? T.green : T.fill, color: online ? '#fff' : T.sub,
          border: 'none', borderRadius: 2, cursor: 'pointer',
          fontFamily: FONT, fontWeight: 600, fontSize: 11, padding: '5px 9px',
        }}
      >
        <span style={{ display: 'inline-flex', color: online ? '#fff' : T.green }}>
          <ModeIcon mode={choice.mode} />
        </span>
        {MODE_COPY[choice.mode].label}
      </button>

      {menuOpen && !choice.noticeOpen && (
        <Sheet labelledBy={titleId} onClose={() => setMenuOpen(false)}>
          <h2 id={titleId} style={{
            margin: '0 0 14px', fontSize: 20, fontWeight: 700, color: T.ink, letterSpacing: -0.3,
          }}>
            Choose a mode
          </h2>
          <ModeOptions mode={choice.mode} onChoose={chooseFromMenu} />
        </Sheet>
      )}

      {choice.noticeOpen && (
        <OnlineNotice
          onAccept={() => { choice.accept(); setMenuOpen(false) }}
          onCancel={choice.cancel}
          onLearnMore={() => { setMenuOpen(false); choice.learnMore() }}
        />
      )}
    </>
  )
}
