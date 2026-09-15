import { useCallback, useState } from 'react'
import { AppCtx, DETECTION_IDLE } from './useAppState.js'
import { normaliseAppMode, readStoredAppMode, saveStoredAppMode } from './appMode.js'

const DEFAULT_PREFERENCES = {
  diets: [],
  allergies: [],
  goals: [],
  cuisinePreference: null,
  mealType: null,
}

export function AppStateProvider({ children }) {
  const [photo, setPhoto] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [detection, setDetection] = useState(DETECTION_IDLE)
  const [recommendationResult, setRecommendationResult] = useState(null)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [mode, setModeState] = useState(readStoredAppMode)
  // The assistant's conversation lives here rather than in the drawer, so it
  // carries across screens: the drawer unmounts wherever there is no assistant.
  const [chatMessages, setChatMessages] = useState([])

  /**
   * Switching mode drops the cached recommendations. A list ranked in Online mode
   * can hold generated recipes, and one ranked in Local mode never asked for
   * them, so neither is valid under the other mode. Clearing here rather than on
   * each screen means no screen can keep showing a list from the old mode. The
   * conversation belongs to Online mode, so it ends with it.
   */
  const setMode = useCallback((next) => {
    const target = normaliseAppMode(next)
    saveStoredAppMode(target)
    setModeState(target)
    setRecommendationResult(null)
    setSelectedRecipe(null)
    setChatMessages([])
  }, [])

  return (
    <AppCtx.Provider value={{
      photo, setPhoto,
      ingredients, setIngredients,
      preferences, setPreferences,
      detection, setDetection,
      recommendationResult, setRecommendationResult,
      selectedRecipe, setSelectedRecipe,
      mode, setMode,
      chatMessages, setChatMessages,
    }}>
      {children}
    </AppCtx.Provider>
  )
}
