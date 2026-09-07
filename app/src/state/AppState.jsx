import { useState } from 'react'
import { AppCtx, DETECTION_IDLE } from './useAppState.js'

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
  return (
    <AppCtx.Provider value={{
      photo, setPhoto,
      ingredients, setIngredients,
      preferences, setPreferences,
      detection, setDetection,
      recommendationResult, setRecommendationResult,
      selectedRecipe, setSelectedRecipe,
    }}>
      {children}
    </AppCtx.Provider>
  )
}
