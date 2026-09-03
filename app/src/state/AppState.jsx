import { useState } from 'react'
import { AppCtx, DETECTION_IDLE } from './useAppState.js'

export function AppStateProvider({ children }) {
  const [photo, setPhoto] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [preferences, setPreferences] = useState({ diets: [], allergies: [] })
  const [detection, setDetection] = useState(DETECTION_IDLE)
  return (
    <AppCtx.Provider value={{
      photo, setPhoto,
      ingredients, setIngredients,
      preferences, setPreferences,
      detection, setDetection,
    }}>
      {children}
    </AppCtx.Provider>
  )
}
