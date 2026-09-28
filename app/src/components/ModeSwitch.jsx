import { useEffect, useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import {
  APP_MODES,
  hasOnlineConsent,
  isOnlineMode,
  saveOnlineConsent,
} from '../state/appMode.js'

const T = {
  bg: '#FFFFFF',
  warm: '#FCFAF5',

  ink: '#172019',
  sub: '#6E756F',
  faint: '#929892',

  green: '#174D38',
  greenDark: '#103D2C',
  greenSoft: '#E8F2EA',

  line: '#E9E7E1',
  fill: '#F7F4EC',
}

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'

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

/* =========================================================
   Icons
   ========================================================= */

function DeviceIcon({ size = 12 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </svg>
  )
}

function SparkIcon({ size = 12 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
    </svg>
  )
}

function ModeIcon({ mode, size }) {
  return isOnlineMode(mode)
    ? <SparkIcon size={size} />
    : <DeviceIcon size={size} />
}

/* =========================================================
   Mode logic
   ========================================================= */

function useModeChoice() {
  const { mode, setMode } = useAppState()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [noticeOpen, setNoticeOpen] = useState(false)

  function apply(next) {
    setNoticeOpen(false)

    if (next === mode) return

    setMode(next)

    if (RECIPE_SCREENS.test(pathname)) {
      navigate('/recommendations')
    }
  }

  function needsNotice(next) {
    return (
      next !== mode &&
      isOnlineMode(next) &&
      !hasOnlineConsent()
    )
  }

  function choose(next) {
    if (next === mode) return

    if (needsNotice(next)) {
      setNoticeOpen(true)
    } else {
      apply(next)
    }
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

    cancel: () => {
      setNoticeOpen(false)
    },

    learnMore: () => {
      setNoticeOpen(false)
      navigate('/privacy')
    },
  }
}

/* =========================================================
   Bottom Sheet
   ========================================================= */

function Sheet({ labelledBy, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,

        zIndex: 100,

        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',

        background: 'rgba(12, 25, 18, 0.38)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',

        fontFamily: FONT,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          maxHeight: '88vh',

          overflowY: 'auto',

          boxSizing: 'border-box',

          background: T.warm,

          border: `1px solid ${T.line}`,
          borderBottom: 'none',

          borderRadius: '26px 26px 0 0',

          boxShadow:
            '0 -18px 50px rgba(15,45,32,.16)',

          padding:
            '12px 20px calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        {/* drag handle */}
        <div
          style={{
            width: 38,
            height: 4,

            margin: '0 auto 18px',

            borderRadius: 999,
            background: '#D5D5CF',
          }}
        />

        {children}
      </div>
    </div>
  )
}

/* =========================================================
   Online consent
   ========================================================= */

function OnlineNotice({
  onAccept,
  onCancel,
  onLearnMore,
}) {
  const titleId = useId()

  return (
    <Sheet
      labelledBy={titleId}
      onClose={onCancel}
    >
      <div
        style={{
          width: 44,
          height: 44,

          display: 'grid',
          placeItems: 'center',

          borderRadius: 14,

          background: T.greenSoft,
          color: T.green,

          marginBottom: 16,
        }}
      >
        <SparkIcon size={20} />
      </div>

      <h2
        id={titleId}
        style={{
          margin: 0,

          fontSize: 23,
          fontWeight: 800,

          color: T.ink,
          letterSpacing: '-0.7px',
        }}
      >
        Turn on Online mode?
      </h2>

      <p
        style={{
          margin: '10px 0 0',

          fontSize: 14,
          color: T.sub,

          lineHeight: 1.6,
        }}
      >
        Your ingredient list, preferences and chat messages
        are sent to Google Gemini. Photos always stay on your
        device.{' '}

        <button
          type="button"
          onClick={onLearnMore}
          style={{
            padding: 0,

            border: 'none',
            background: 'none',

            color: T.green,

            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 700,

            cursor: 'pointer',
          }}
        >
          Learn more
        </button>
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,

          marginTop: 24,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            minHeight: 50,

            background: T.bg,
            color: T.ink,

            border: `1px solid ${T.line}`,
            borderRadius: 14,

            padding: '13px 12px',

            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 14,

            cursor: 'pointer',
          }}
        >
          Not now
        </button>

        <button
          type="button"
          onClick={onAccept}
          style={{
            minHeight: 50,

            background: T.green,
            color: '#FFFFFF',

            border: 'none',
            borderRadius: 14,

            padding: '13px 12px',

            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 14,

            cursor: 'pointer',

            boxShadow:
              '0 8px 20px rgba(23,77,56,.18)',
          }}
        >
          Turn on
        </button>
      </div>
    </Sheet>
  )
}

/* =========================================================
   Mode Cards
   ========================================================= */

function ModeOptions({ mode, onChoose }) {
  return (
    <div
      role="radiogroup"
      aria-label="App mode"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}
    >
      {[APP_MODES.LOCAL, APP_MODES.ONLINE].map(
        (option) => {
          const active = option === mode

          return (
            <button
              key={option}
              type="button"

              role="radio"
              aria-checked={active}

              onClick={() => onChoose(option)}

              style={{
                position: 'relative',

                minHeight: 136,

                padding: 14,

                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',

                textAlign: 'left',

                background:
                  active
                    ? T.greenSoft
                    : T.bg,

                border:
                  active
                    ? `1.5px solid ${T.green}`
                    : `1px solid ${T.line}`,

                borderRadius: 18,

                cursor: 'pointer',

                fontFamily: FONT,

                boxShadow:
                  active
                    ? '0 7px 20px rgba(23,77,56,.08)'
                    : '0 3px 12px rgba(24,48,36,.035)',

                transition:
                  'transform .15s ease, box-shadow .15s ease, border .15s ease',
              }}
            >
              <div
                style={{
                  width: '100%',

                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,

                    borderRadius: 11,

                    display: 'grid',
                    placeItems: 'center',

                    background:
                      active
                        ? T.green
                        : T.fill,

                    color:
                      active
                        ? '#FFFFFF'
                        : T.green,
                  }}
                >
                  <ModeIcon
                    mode={option}
                    size={17}
                  />
                </span>

                {active && (
                  <span
                    style={{
                      padding: '4px 8px',

                      borderRadius: 999,

                      background:
                        'rgba(255,255,255,.75)',

                      color: T.green,

                      fontSize: 9,
                      fontWeight: 800,

                      textTransform: 'uppercase',
                      letterSpacing: '.09em',
                    }}
                  >
                    ON
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: 14,

                  fontWeight: 750,
                  fontSize: 14.5,

                  color: T.ink,
                }}
              >
                {MODE_COPY[option].label}
              </div>

              <div
                style={{
                  marginTop: 5,

                  fontSize: 11.5,
                  color: T.sub,

                  lineHeight: 1.42,
                }}
              >
                {MODE_COPY[option].summary}
              </div>
            </button>
          )
        }
      )}
    </div>
  )
}

/* =========================================================
   Home mode selector
   ========================================================= */

export function ModeSelector() {
  const choice = useModeChoice()

  return (
    <>
      <ModeOptions
        mode={choice.mode}
        onChoose={choice.choose}
      />

      {choice.noticeOpen && (
        <OnlineNotice
          onAccept={choice.accept}
          onCancel={choice.cancel}
          onLearnMore={choice.learnMore}
        />
      )}
    </>
  )
}

/* =========================================================
   Header mode badge
   ========================================================= */

export function ModeBadge() {
  const choice = useModeChoice()

  const [menuOpen, setMenuOpen] =
    useState(false)

  const titleId = useId()

  const online = isOnlineMode(choice.mode)

  function chooseFromMenu(next) {
    if (!choice.needsNotice(next)) {
      setMenuOpen(false)
    }

    choice.choose(next)
  }

  return (
    <>
      <button
        type="button"

        onClick={() => setMenuOpen(true)}

        aria-label={`${MODE_COPY[choice.mode].label}. Change mode`}

        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,

          flexShrink: 0,

          padding: '7px 11px',

          background:
            online
              ? T.green
              : T.greenSoft,

          color:
            online
              ? '#FFFFFF'
              : T.green,

          border:
            online
              ? 'none'
              : '1px solid rgba(23,77,56,.08)',

          borderRadius: 999,

          cursor: 'pointer',

          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 10.5,

          letterSpacing: '.01em',

          boxShadow:
            online
              ? '0 5px 14px rgba(23,77,56,.16)'
              : 'none',

          transition:
            'transform .15s ease, box-shadow .15s ease',
        }}
      >
        <span
          style={{
            display: 'inline-flex',

            color:
              online
                ? '#FFFFFF'
                : T.green,
          }}
        >
          <ModeIcon
            mode={choice.mode}
            size={12}
          />
        </span>

        {MODE_COPY[choice.mode].label}
      </button>

      {menuOpen && !choice.noticeOpen && (
        <Sheet
          labelledBy={titleId}
          onClose={() => setMenuOpen(false)}
        >
          <div
            style={{
              marginBottom: 20,
            }}
          >
            <h2
              id={titleId}
              style={{
                margin: 0,

                fontSize: 23,
                fontWeight: 800,

                color: T.ink,

                letterSpacing: '-0.7px',
              }}
            >
              Choose a mode
            </h2>

            <p
              style={{
                margin: '7px 0 0',

                color: T.sub,

                fontSize: 13.5,
                lineHeight: 1.5,
              }}
            >
              Choose how SnapWell processes your
              ingredients and generates recipes.
            </p>
          </div>

          <ModeOptions
            mode={choice.mode}
            onChoose={chooseFromMenu}
          />
        </Sheet>
      )}

      {choice.noticeOpen && (
        <OnlineNotice
          onAccept={() => {
            choice.accept()
            setMenuOpen(false)
          }}

          onCancel={choice.cancel}

          onLearnMore={() => {
            setMenuOpen(false)
            choice.learnMore()
          }}
        />
      )}
    </>
  )
}