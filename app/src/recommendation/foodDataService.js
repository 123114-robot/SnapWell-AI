const FOOD_DATA_BASE = '/data/food_data'

const DATA_FILES = Object.freeze({
  recipes: `${FOOD_DATA_BASE}/recipes-v1.json`,
  ingredientNutrition: `${FOOD_DATA_BASE}/ingredient-nutrition-v1.json`,
  recipeIngredientMap: `${FOOD_DATA_BASE}/recipe-ingredient-map-v1.json`,
  ingredientPortions: `${FOOD_DATA_BASE}/ingredient-portions-v1.json`,
  recipePortions: `${FOOD_DATA_BASE}/recipe-portions-v1.json`,
  missingIngredientLinks: `${FOOD_DATA_BASE}/missing-ingredient-links-v1.json`,
})

const requestCache = new Map()

async function fetchJson(url) {
  if (!requestCache.has(url)) {
    const request = fetch(url).then(async response => {
      if (!response.ok) {
        throw new Error(`Unable to load food data (${response.status} ${response.statusText})`)
      }
      return response.json()
    }).catch(error => {
      requestCache.delete(url)
      throw error
    })

    requestCache.set(url, request)
  }

  return requestCache.get(url)
}

export async function loadRecipes() {
  const data = await fetchJson(DATA_FILES.recipes)
  if (!Array.isArray(data?.recipes)) {
    throw new Error('Recipe data is invalid: expected a recipes array')
  }
  return data.recipes
}

export async function loadIngredientNutrition() {
  const data = await fetchJson(DATA_FILES.ingredientNutrition)
  if (!Array.isArray(data?.items)) {
    throw new Error('Ingredient nutrition data is invalid: expected an items array')
  }
  return data
}

export async function loadRecipeIngredientMap() {
  const data = await fetchJson(DATA_FILES.recipeIngredientMap)
  if (!data?.recipes || typeof data.recipes !== 'object') {
    throw new Error('Recipe ingredient map is invalid: expected recipes')
  }
  return data
}

export async function loadIngredientPortions() {
  const data = await fetchJson(DATA_FILES.ingredientPortions)
  if (!data?.portions || typeof data.portions !== 'object') {
    throw new Error('Ingredient portion data is invalid: expected portions')
  }
  return data
}

export async function loadRecipePortions() {
  const data = await fetchJson(DATA_FILES.recipePortions)
  if (!data?.recipes || typeof data.recipes !== 'object') {
    throw new Error('Recipe portion data is invalid: expected recipes')
  }
  return data
}

export async function loadMissingIngredientLinks() {
  const data = await fetchJson(DATA_FILES.missingIngredientLinks)
  if (!data?.providers || typeof data.providers !== 'object') {
    throw new Error('Missing-ingredient link data is invalid: expected providers')
  }
  return data
}

export async function loadRecommendationData() {
  const [recipes, ingredientNutrition] = await Promise.all([
    loadRecipes(),
    loadIngredientNutrition(),
  ])

  return { recipes, ingredientNutrition }
}

export async function loadNutritionCalculationData() {
  const [ingredientNutrition, recipeIngredientMap, ingredientPortions, recipePortions] = await Promise.all([
    loadIngredientNutrition(),
    loadRecipeIngredientMap(),
    loadIngredientPortions(),
    loadRecipePortions(),
  ])

  return {
    ingredientNutrition,
    recipeIngredientMap,
    ingredientPortions,
    recipePortions,
  }
}

export function clearFoodDataCache() {
  requestCache.clear()
}
