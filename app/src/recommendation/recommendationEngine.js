import { loadNutritionCalculationData, loadRecommendationData } from './foodDataService.js'
import { matchRecipes, normaliseConfirmedIngredients, createIngredientAliasMap } from './recipeMatcher.js'
import { calculateRecipeNutrition } from './nutritionService.js'

export const LOCAL_MATCH_THRESHOLD = 70

function safePreferences(preferences) {
  return preferences && typeof preferences === 'object'
    ? preferences
    : {}
}

export async function recommendationEngine(input = {}, dataOverride = null) {
  const data = dataOverride ?? await loadRecommendationData()
  const ingredients = Array.isArray(input?.ingredients) ? input.ingredients : []
  const preferences = safePreferences(input?.preferences)
  const matches = matchRecipes({
    recipes: data.recipes,
    ingredientNutrition: data.ingredientNutrition,
    ingredients,
    preferences,
  })
  let nutritionData = null

  if (dataOverride) {
    const hasNutritionData = dataOverride.recipeIngredientMap
      && dataOverride.ingredientPortions
      && dataOverride.recipePortions
    nutritionData = hasNutritionData ? dataOverride : null
  } else {
    try {
      nutritionData = await loadNutritionCalculationData()
    } catch {
      nutritionData = null
    }
  }

  const recommendations = matches.map(result => ({
    ...result,
    nutrition: nutritionData
      ? calculateRecipeNutrition({
        recipeId: result.recipe.recipe_id,
        ...nutritionData,
      })
      : {
        available: false,
        estimated: true,
        reason: 'Nutrition reference data could not be loaded.',
        unresolvedIngredients: [],
      },
  }))
  const aliasMap = createIngredientAliasMap(data.ingredientNutrition)
  const confirmedIngredientLabels = normaliseConfirmedIngredients(ingredients, aliasMap)
  const topCoverageScore = recommendations[0]?.coverageScore ?? 0
  const fallbackRequired = recommendations.length === 0
    || topCoverageScore < LOCAL_MATCH_THRESHOLD

  return {
    mode: fallbackRequired ? 'ai-fallback' : 'local',
    threshold: LOCAL_MATCH_THRESHOLD,
    fallbackRequired,
    topCoverageScore,
    recommendations,
    inputContext: {
      ingredients,
      preferences,
      confirmedIngredientLabels,
    },
    diagnostics: {
      eligibleRecipeCount: recommendations.length,
      confirmedIngredientCount: confirmedIngredientLabels.length,
    },
  }
}

export default recommendationEngine
