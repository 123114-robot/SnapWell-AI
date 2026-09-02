import { createContext, useContext, useState } from 'react'

const AppCtx = createContext(null)

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
  const [recommendationResult, setRecommendationResult] = useState(null)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  return (
    <AppCtx.Provider value={{
      photo,
      setPhoto,
      ingredients,
      setIngredients,
      preferences,
      setPreferences,
      recommendationResult,
      setRecommendationResult,
      selectedRecipe,
      setSelectedRecipe,
    }}>
      {children}
    </AppCtx.Provider>
  )
}

export const useAppState = () => useContext(AppCtx)
