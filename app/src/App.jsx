import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import SplashScreen from './components/SplashScreen.jsx'
import { ModelProvider } from './ai/ModelContext.jsx'
import { useModel } from './ai/useModel.js'
import { AppStateProvider } from './state/AppState.jsx'
import Home from './screens/Home.jsx'
import Privacy from './screens/Privacy.jsx'
import Preferences from './screens/Preferences.jsx'
import Capture from './screens/Capture.jsx'
import ScanBarcode from './screens/ScanBarcode.jsx'
import ScanPackage from './screens/ScanPackage.jsx'
import ProductReport from './screens/ProductReport.jsx'
import Processing from './screens/Processing.jsx'
import IngredientConfirm from './screens/IngredientConfirm.jsx'
import QuantityAdjust from './screens/QuantityAdjust.jsx'
import Recommendations from './screens/Recommendations.jsx'
import MissingIngredients from './screens/MissingIngredients.jsx'
import RecipeDetail from './screens/RecipeDetail.jsx'
import NutritionInfo from './screens/NutritionInfo.jsx'
import BottomNav from './components/BottomNav.jsx'
import ChatFab from './components/ChatFab.jsx'
import { ModeBadge } from './components/ModeSwitch.jsx'

const topRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }

function ModelBadge({ trailing = null }) {
  const { status, progress } = useModel()
  const pct = status === 'ready' || status === 'warming'
    ? 100
    : Math.min(100, Math.round((progress || 0) * 100))

  if (status === 'ready') {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', padding: '10px 20px 6px',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={topRow}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: '#1B4332',
            letterSpacing: 0.2,
          }}>
            On-device AI ready
          </div>
          {trailing}
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', padding: '10px 20px 6px',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={topRow}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#D64525' }}>
            Model failed to load
          </div>
          {trailing}
        </div>
      </div>
    )
  }

  const label = status === 'warming'
    ? 'Warming up model…'
    : `Loading model… ${pct}%`

  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', padding: '10px 20px 8px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ ...topRow, marginBottom: 8 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#5E6E64',
        }}>
          {label}
        </div>
        {trailing}
      </div>
      <div style={{
        height: 8, borderRadius: 999, background: '#E7EFE9', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 999,
          background: 'linear-gradient(90deg, #1B4332 0%, #2D6A4F 40%, #E9A824 100%)',
          boxShadow: '0 0 10px rgba(233, 168, 36, 0.45)',
          transition: 'width 0.2s ease-out',
        }} />
      </div>
    </div>
  )
}

/**
 * The bar above every screen. Home already carries the mode badge in its own
 * header, beside the mode picker, so it is left out here to avoid two badges
 * stacked on top of each other.
 */
function TopBar() {
  const { pathname } = useLocation()
  return <ModelBadge trailing={pathname === '/' ? null : <ModeBadge />} />
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (showSplash) {
    return <SplashScreen />
  }

  return (
    <ModelProvider>
      <AppStateProvider>
        <BrowserRouter>
          <div style={{ paddingBottom: 88, minHeight: '100vh', boxSizing: 'border-box' }}>
            <TopBar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/preferences" element={<Preferences />} />
              <Route path="/capture" element={<Capture />} />
              <Route path="/scan-package" element={<ScanBarcode />} />
              <Route path="/scan-package/label" element={<ScanPackage />} />
              <Route path="/product/:barcode" element={<ProductReport />} />
              <Route path="/processing" element={<Processing />} />
              <Route path="/confirm" element={<IngredientConfirm />} />
              {/* 检测结果页已并入确认页；保留重定向，旧链接和浏览器历史不至于落到空白页 */}
              <Route path="/results" element={<Navigate to="/confirm" replace />} />
              <Route path="/quantity" element={<QuantityAdjust />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/missing" element={<MissingIngredients />} />
              <Route path="/recipe/:id" element={<RecipeDetail />} />
              <Route path="/nutrition/:id" element={<NutritionInfo />} />
            </Routes>
          </div>
          <ChatFab />
          <BottomNav />
        </BrowserRouter>
      </AppStateProvider>
    </ModelProvider>
  )
}
