import { useLocation, useNavigate } from 'react-router-dom'

const T = {
  green: '#174D38',
  muted: '#879089',
  line: '#E8E5DE',
  paper: 'rgba(252, 250, 245, 0.94)',
  active: '#E7F0E9',
}

const TABS = [
  {
    id: 'home',
    label: 'Home',
    to: '/',
    match: (p) => p === '/',
    icon: (active) => (
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },

  {
    id: 'scan',
    label: 'Scan',
    to: '/capture',
    match: (p) =>
      ['/capture', '/processing'].includes(p) ||
      p.startsWith('/scan-package') ||
      p.startsWith('/product/'),
    icon: (active) => (
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },

  {
    id: 'ingredients',
    label: 'List',
    to: '/confirm',
    match: (p) => ['/confirm', '/quantity'].includes(p),
    icon: (active) => (
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },

  {
    id: 'recipes',
    label: 'Recipes',
    to: '/recommendations',
    match: (p) =>
      p.startsWith('/recommendations') ||
      p.startsWith('/recipe') ||
      p.startsWith('/nutrition') ||
      p === '/missing',
    icon: (active) => (
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },

  {
    id: 'settings',
    label: 'Settings',
    to: '/preferences',
    match: (p) =>
      p === '/preferences' || p === '/privacy',
    icon: (active) => (
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname === '/processing') return null

  return (
    <nav
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 0,

        width: '100%',
        maxWidth: 430,

        zIndex: 50,

        padding:
          '7px 8px calc(7px + env(safe-area-inset-bottom, 0px))',

        background: T.paper,

        borderTop: `1px solid ${T.line}`,

        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',

        boxShadow:
          '0 -8px 30px rgba(20, 50, 36, 0.05)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          gap: 2,
        }}
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname)

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.to)}
              aria-label={tab.label}
              style={{
                minHeight: 52,

                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,

                border: 'none',
                borderRadius: 14,

                background:
                  active ? T.active : 'transparent',

                color:
                  active ? T.green : T.muted,

                fontFamily: 'inherit',
                cursor: 'pointer',

                transition:
                  'background .18s ease, color .18s ease, transform .15s ease',
              }}
            >
              <div
                style={{
                  height: 23,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {tab.icon(active)}
              </div>

              <span
                style={{
                  fontSize: 10,
                  lineHeight: 1,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '.01em',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export const NAV_CONTENT_PAD = 88