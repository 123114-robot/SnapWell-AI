import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { ModelProvider, useModel } from './ai/ModelContext.jsx'
import { AppStateProvider } from './state/AppState.jsx'
import Home from './screens/Home.jsx'
import Privacy from './screens/Privacy.jsx'
import Preferences from './screens/Preferences.jsx'
import Capture from './screens/Capture.jsx'
import ScanPackage from './screens/ScanPackage.jsx'
import Processing from './screens/Processing.jsx'
import IngredientConfirm from './screens/IngredientConfirm.jsx'
import QuantityAdjust from './screens/QuantityAdjust.jsx'
import Recommendations from './screens/Recommendations.jsx'
import MissingIngredients from './screens/MissingIngredients.jsx'
import RecipeDetail from './screens/RecipeDetail.jsx'
import NutritionInfo from './screens/NutritionInfo.jsx'
import BottomNav from './components/BottomNav.jsx'

function ModelBadge() {
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
        <div style={{
          fontSize: 16, fontWeight: 700, color: '#1B4332',
          letterSpacing: 0.2,
        }}>
          On-device AI ready
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', padding: '10px 20px 6px',
        fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: 600, color: '#D64525',
      }}>
        Model failed to load
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
      <div style={{
        fontSize: 13, fontWeight: 600, color: '#5E6E64', marginBottom: 8,
      }}>
        {label}
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

export default function App() {
  return (
    <ModelProvider>
      <AppStateProvider>
        <BrowserRouter>
          <div style={{ paddingBottom: 88, minHeight: '100vh', boxSizing: 'border-box' }}>
            <ModelBadge />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/preferences" element={<Preferences />} />
              <Route path="/capture" element={<Capture />} />
              <Route path="/scan-package" element={<ScanPackage />} />
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
          <BottomNav />
        </BrowserRouter>
      </AppStateProvider>
    </ModelProvider>
  )
}
