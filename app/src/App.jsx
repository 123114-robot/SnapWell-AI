import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ModelProvider, useModel } from './ai/ModelContext.jsx'
import { AppStateProvider } from './state/AppState.jsx'
import Home from './screens/Home.jsx'
import Privacy from './screens/Privacy.jsx'
import Preferences from './screens/Preferences.jsx'
import Capture from './screens/Capture.jsx'
import Processing from './screens/Processing.jsx'
import DetectionResults from './screens/DetectionResults.jsx'
import IngredientConfirm from './screens/IngredientConfirm.jsx'
import QuantityAdjust from './screens/QuantityAdjust.jsx'
import Recommendations from './screens/Recommendations.jsx'
import MissingIngredients from './screens/MissingIngredients.jsx'
import RecipeDetail from './screens/RecipeDetail.jsx'
import NutritionInfo from './screens/NutritionInfo.jsx'

function ModelBadge() {
  const { status, progress } = useModel()
  const text = status === 'ready' ? 'AI model ready'
    : status === 'error' ? 'Model failed to load'
    : status === 'warming' ? 'Warming up model...'
    : 'Loading model... ' + Math.round(progress * 100) + '%'
  return <div style={{ fontSize: 12, color: '#666', padding: '4px 16px' }}>{text}</div>
}

export default function App() {
  return (
    <ModelProvider>
      <AppStateProvider>
        <BrowserRouter>
          <ModelBadge />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/processing" element={<Processing />} />
            <Route path="/results" element={<DetectionResults />} />
            <Route path="/confirm" element={<IngredientConfirm />} />
            <Route path="/quantity" element={<QuantityAdjust />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/missing" element={<MissingIngredients />} />
            <Route path="/recipe/:id" element={<RecipeDetail />} />
            <Route path="/nutrition/:id" element={<NutritionInfo />} />
          </Routes>
        </BrowserRouter>
      </AppStateProvider>
    </ModelProvider>
  )
}
