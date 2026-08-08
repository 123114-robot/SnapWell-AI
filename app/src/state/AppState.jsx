import { createContext, useContext, useState } from 'react'

const AppCtx = createContext(null)

export function AppStateProvider({ children }) {
  const [photo, setPhoto] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [preferences, setPreferences] = useState({ diets: [], allergies: [] })
  return (
    <AppCtx.Provider value={{ photo, setPhoto, ingredients, setIngredients, preferences, setPreferences }}>
      {children}
    </AppCtx.Provider>
  )
}

export const useAppState = () => useContext(AppCtx)
