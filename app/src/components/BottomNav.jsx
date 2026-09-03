import { useLocation, useNavigate } from 'react-router-dom'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  muted: '#5E6E64', line: '#E4E0D6',
}

const TABS = [
  {
    id: 'home',
    label: 'Home',
    to: '/',
    match: (p) => p === '/',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    id: 'scan',
    label: 'Scan',
    to: '/capture',
    match: (p) => ['/capture', '/processing', '/scan-package'].includes(p),
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    id: 'recipes',
    label: 'Recipes',
    to: '/recommendations',
    match: (p) => p.startsWith('/recommendations') || p.startsWith('/recipe') || p.startsWith('/nutrition') || p === '/missing',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    to: '/preferences',
    match: (p) => p === '/preferences' || p === '/privacy',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

/** Bottom tab bar. Hidden on the transient processing screen. */
export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname === '/processing') return null

  return (
    <nav style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
      background: 'rgba(250,247,240,0.96)',
      borderTop: `1px solid ${T.line}`,
      backdropFilter: 'blur(10px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{
        maxWidth: 430, margin: '0 auto',
        display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
        padding: '6px 4px 8px',
      }}>
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.to)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 2px', fontFamily: 'inherit',
                color: active ? T.green : T.muted,
              }}
            >
              {tab.icon(active)}
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2,
              }}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Extra bottom padding so screen content clears the fixed tab bar. */
export const NAV_CONTENT_PAD = 88
