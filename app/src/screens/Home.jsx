import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { isOnlineMode } from '../state/appMode.js'
import { ModeBadge, ModeSelector } from '../components/ModeSwitch.jsx'
import { emojiForIngredient } from '../data/foodData.js'

const C = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  sub: '#6E6E73',
  faint: '#86868B',
  green: '#174D38',
  greenSoft: '#F1F6F3',
  line: '#E5E5E7',
  fill: '#F5F5F7',
}

export default function Home() {
  const navigate = useNavigate()
  const { ingredients, mode } = useAppState()

  const recent = Array.isArray(ingredients)
    ? ingredients.slice(0, 6)
    : []

  return (
    <div
      style={{
        minHeight: '100vh',
        maxWidth: 430,
        margin: '0 auto',
        paddingBottom: 38,
        background: C.bg,
        color: C.ink,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '18px 20px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              background: C.green,
              color: '#fff',
              borderRadius: 8,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.9 5.8L20 10.7l-5.8 1.9L12 18l-1.9-5.4L4 10.7l6.1-1.9z" />
            </svg>
          </div>

          <span
            style={{
              fontWeight: 750,
              fontSize: 21,
              letterSpacing: '-0.6px',
            }}
          >
            SnapWell
          </span>
        </div>

        <ModeBadge />
      </header>

      {/* Hero */}
      <section style={{ padding: '34px 20px 0' }}>
        <div
          style={{
            color: C.green,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          AI Recipe Assistant
        </div>

        <h1
          style={{
            margin: 0,
            maxWidth: 350,
            fontSize: 36,
            fontWeight: 750,
            letterSpacing: '-1.45px',
            lineHeight: 1.03,
          }}
        >
          Cook with what
          <br />
          you already have.
        </h1>

        <p
          style={{
            margin: '15px 0 0',
            maxWidth: 350,
            fontSize: 15,
            lineHeight: 1.55,
            color: C.sub,
          }}
        >
          Snap your ingredients and find recipes matched to what is already
          in your kitchen —{' '}
          {isOnlineMode(mode)
            ? 'with ingredient recognition staying on your device.'
            : 'all on your device.'}
        </p>
      </section>

      {/* Primary action */}
      <section style={{ padding: '25px 20px 0' }}>
        <button
          type="button"
          onClick={() => navigate('/capture')}
          style={{
            width: '100%',
            minHeight: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            border: 'none',
            borderRadius: 8,
            background: C.green,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 15.5,
            fontWeight: 650,
            cursor: 'pointer',
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Snap ingredients
        </button>
      </section>

      {/* Mode */}
      <section style={{ padding: '31px 20px 0' }}>
        <SectionHeader title="Mode" />
        <div
          style={{
            border: `1px solid ${C.line}`,
            background: C.surface,
            borderRadius: 8,
            padding: 3,
          }}
        >
          <ModeSelector />
        </div>
      </section>

      {/* Recently detected */}
      <section style={{ padding: '31px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 11,
          }}
        >
          <SectionHeader title="Recently detected" noMargin />

          {recent.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/confirm')}
              style={{
                border: 'none',
                padding: 0,
                background: 'transparent',
                color: C.green,
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              See all
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <div
            style={{
              padding: '21px 18px',
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              background: C.surface,
              color: C.faint,
              textAlign: 'center',
              fontSize: 13.5,
              lineHeight: 1.5,
            }}
          >
            Nothing yet — snap a photo to detect your ingredients.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 7,
              overflowX: 'auto',
              padding: '1px 0 3px',
              scrollbarWidth: 'none',
            }}
          >
            {recent.map((it, i) => (
              <button
                key={it.id ?? i}
                type="button"
                onClick={() => navigate('/confirm')}
                style={{
                  flex: '0 0 64px',
                  width: 64,
                  minWidth: 64,
                  height: 70,
                  padding: '8px 5px 7px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: C.surface,
                  border: `1px solid ${C.line}`,
                  borderRadius: 6,
                  fontFamily: 'inherit',
                  color: C.ink,
                  cursor: 'pointer',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                    lineHeight: 1,
                  }}
                >
                  {emojiForIngredient(it.label)}
                </div>

                <div
                  style={{
                    width: '100%',
                    marginTop: 5,
                    fontSize: 9.5,
                    lineHeight: 1.15,
                    fontWeight: 550,
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {String(it.label || '').replace(/_/g, ' ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recipe shortcut */}
      <section style={{ padding: '30px 20px 0' }}>
        <SectionHeader title="For you" />

        <button
          type="button"
          onClick={() => navigate('/recommendations')}
          style={{
            width: '100%',
            minHeight: 82,
            padding: '14px 15px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textAlign: 'left',
            background: C.surface,
            border: `1px solid ${C.line}`,
            borderRadius: 6,
            fontFamily: 'inherit',
            color: C.ink,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 45,
              height: 45,
              flexShrink: 0,
              borderRadius: 7,
              background: C.greenSoft,
              color: C.green,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: 15 }}>
              See recipe matches
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12.5,
                color: C.sub,
              }}
            >
              Recipes ranked by the ingredients you have
            </div>
          </div>

          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.faint}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </section>

      {/* How it works */}
      <section style={{ padding: '30px 20px 0' }}>
        <SectionHeader title="How it works" />

        <div
          style={{
            borderTop: `1px solid ${C.line}`,
          }}
        >
          {[
            ['01', 'Snap or upload a photo of your ingredients'],
            ['02', 'Review the detected ingredients and make any edits'],
            ['03', 'Get recipes matched to what you already have'],
          ].map(([number, text]) => (
            <div
              key={number}
              style={{
                minHeight: 59,
                display: 'grid',
                gridTemplateColumns: '38px 1fr',
                alignItems: 'center',
                gap: 7,
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              <div
                style={{
                  color: C.green,
                  fontSize: 12,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {number}
              </div>

              <div
                style={{
                  color: C.ink,
                  fontSize: 13.5,
                  fontWeight: 450,
                  lineHeight: 1.4,
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ title, noMargin = false }) {
  return (
    <div
      style={{
        marginBottom: noMargin ? 0 : 11,
        color: C.faint,
        fontSize: 11.5,
        fontWeight: 650,
        letterSpacing: '.075em',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </div>
  )
}
